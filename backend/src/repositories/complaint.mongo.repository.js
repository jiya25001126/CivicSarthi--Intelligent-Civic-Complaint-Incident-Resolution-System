import { ComplaintModel } from '../models/complaint.model.js';
import { StatusHistoryModel } from '../models/statusHistory.model.js';
import { COMPLAINT_STATUS, COMPLAINT_PRIORITY, validateStatusTransition } from '../constants/status.constants.js';
import departmentRepository from './department.repository.js';

/**
 * MongoDB / Mongoose Complaint Repository.
 * Implements the standard ComplaintRepository interface with atomic operations,
 * unique reference collision recovery, and compound index querying.
 */
export class MongoComplaintRepository {
  /**
   * Dynamic unique reference number generator for MongoDB.
   * Scans existing references for the target year and computes the next monotonic sequence.
   */
  async generateReferenceNumber(targetYear = new Date().getFullYear()) {
    const yearStr = String(targetYear);
    const regex = new RegExp(`^(?:CS|JAN)-${yearStr}-(\\d+)`, 'i');

    const matchingComplaints = await ComplaintModel.find(
      { referenceNumber: regex },
      { referenceNumber: 1, id: 1 }
    ).lean();

    const existingRefs = new Set(
      matchingComplaints.map(c => (c.referenceNumber || c.id || '').toUpperCase())
    );

    let maxNum = 0;
    for (const c of matchingComplaints) {
      const ref = c.referenceNumber || c.id || '';
      const match = ref.match(/(?:CS|JAN)-(\d{4})-(\d+)/i);
      if (match && match[1] === yearStr) {
        const num = parseInt(match[2], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }

    let candidateSeq = maxNum + 1;
    let candidateRef = `CS-${yearStr}-${String(candidateSeq).padStart(4, '0')}`;
    while (existingRefs.has(candidateRef.toUpperCase())) {
      candidateSeq++;
      candidateRef = `CS-${yearStr}-${String(candidateSeq).padStart(4, '0')}`;
    }

    return candidateRef;
  }

  /**
   * Find complaints with multi-criteria filtering, search, sorting, and pagination.
   */
  async findAll(filters = {}) {
    const query = {};

    // Filter by Category
    if (filters.category && filters.category !== 'ALL') {
      query.category = filters.category.toLowerCase();
    }

    // Filter by Department
    if (filters.departmentId && filters.departmentId !== 'ALL') {
      query.$or = [{ departmentId: filters.departmentId }, { department: filters.departmentId }];
    } else if (filters.department && filters.department !== 'ALL') {
      query.$or = [{ departmentId: filters.department }, { department: filters.department }];
    }

    // Filter by Status
    if (filters.status && filters.status !== 'ALL') {
      query.status = filters.status;
    }

    // Filter by Citizen Ownership
    if (filters.citizenId) {
      query.citizenId = filters.citizenId;
    }

    // Filter by Priority
    if (filters.priority && filters.priority !== 'ALL') {
      query.priority = filters.priority;
    }

    // Filter by incident
    if (filters.incidentId) {
      query.incidentId = filters.incidentId;
    }

    // Free text search
    if (filters.search && filters.search.trim() !== '') {
      const q = filters.search.trim();
      const searchRegex = new RegExp(q, 'i');
      query.$or = [
        { id: searchRegex },
        { referenceNumber: searchRegex },
        { title: searchRegex },
        { description: searchRegex },
        { category: searchRegex },
        { district: searchRegex },
        { locality: searchRegex }
      ];
    }

    // Sorting
    let sortOptions = { createdAt: -1 };
    if (filters.sort === 'createdAt_asc') {
      sortOptions = { createdAt: 1 };
    } else if (filters.sort === 'createdAt_desc') {
      sortOptions = { createdAt: -1 };
    } else if (filters.sort === 'priority_desc') {
      // Handled after retrieval or via custom aggregation; default to createdAt -1 for query
      sortOptions = { createdAt: -1 };
    }

    // Optional Pagination
    if (filters.page && filters.limit) {
      const page = Math.max(1, parseInt(filters.page, 10));
      const limit = Math.max(1, parseInt(filters.limit, 10));
      const skip = (page - 1) * limit;

      const [total, rawItems] = await Promise.all([
        ComplaintModel.countDocuments(query),
        ComplaintModel.find(query).sort(sortOptions).skip(skip).limit(limit).lean()
      ]);

      const items = rawItems.map(this._formatComplaint);

      if (filters.sort === 'priority_desc') {
        const pMap = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        items.sort((a, b) => (pMap[b.priority] || 0) - (pMap[a.priority] || 0));
      }

      const totalPages = Math.ceil(total / limit);

      return {
        items,
        pagination: {
          total,
          page,
          limit,
          totalPages
        }
      };
    }

    const rawList = await ComplaintModel.find(query).sort(sortOptions).lean();
    const list = rawList.map(this._formatComplaint);

    if (filters.sort === 'priority_desc') {
      const pMap = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      list.sort((a, b) => (pMap[b.priority] || 0) - (pMap[a.priority] || 0));
    }

    return list;
  }

  /**
   * Find a complaint by ID or Reference Number (case-insensitive)
   */
  async findById(idOrRef) {
    if (!idOrRef) return null;
    const target = String(idOrRef).trim();
    const targetRegex = new RegExp(`^${target}$`, 'i');

    const doc = await ComplaintModel.findOne({
      $or: [{ id: targetRegex }, { referenceNumber: targetRegex }]
    }).lean();

    return doc ? this._formatComplaint(doc) : null;
  }

  /**
   * Create a new complaint with bounded retry for duplicate reference collisions.
   */
  async create(complaintData, overrideYear = null) {
    const targetYear = overrideYear || new Date().getFullYear();
    const maxRetries = 5;
    let attempt = 0;

    while (attempt < maxRetries) {
      attempt++;
      const nextRef = await this.generateReferenceNumber(targetYear);
      const timestamp = new Date();

      const newDoc = {
        id: nextRef,
        referenceNumber: nextRef,
        title: complaintData.title || `Civic Grievance ${nextRef}`,
        description: complaintData.description || complaintData.text || '',
        text: complaintData.description || complaintData.text || '',
        category: complaintData.category || 'roads',
        state: complaintData.state || 'Maharashtra',
        district: complaintData.district || 'Pune',
        locality: complaintData.locality || '',
        preferredLanguage: complaintData.preferredLanguage || complaintData.language || 'en',
        language: complaintData.preferredLanguage || complaintData.language || 'en',
        departmentId: complaintData.departmentId || complaintData.department || 'DEPT_ROADS',
        department: complaintData.departmentId || complaintData.department || 'DEPT_ROADS',
        status: COMPLAINT_STATUS.SUBMITTED,
        officialStatus: 'RECEIVED',
        priority: COMPLAINT_PRIORITY.MEDIUM,
        createdAt: timestamp,
        updatedAt: timestamp,
        lastUpdated: timestamp,
        reassignments: 0,
        citizenReminders: 0,
        evidence: complaintData.evidence || [],
        citizenId: complaintData.citizenId || 'SYNTHETIC_CPGRAMS_DEMO',
        assignedOfficerId: complaintData.assignedOfficerId || null,
        citizenName: complaintData.citizenName || undefined,
        citizenEmail: complaintData.citizenEmail || undefined,
        citizenPhone: complaintData.citizenPhone || undefined,
        citizenAddress: complaintData.citizenAddress || undefined,
        statusHistory: [
          {
            timestamp,
            status: COMPLAINT_STATUS.SUBMITTED,
            actorType: 'CITIZEN',
            remarks: 'Grievance submitted by citizen'
          }
        ],
        officerNotes: [],
        synthetic: Boolean(complaintData.synthetic) || false
      };

      try {
        const created = await ComplaintModel.create(newDoc);

        // Also record in independent StatusHistory collection
        try {
          await StatusHistoryModel.create({
            id: `HIST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            complaintId: created.id,
            referenceNumber: created.referenceNumber,
            timestamp,
            status: COMPLAINT_STATUS.SUBMITTED,
            actorType: 'CITIZEN',
            remarks: 'Grievance submitted by citizen'
          });
        } catch (histErr) {
          console.warn(`[Persistence Warning] Standalone StatusHistoryModel creation failed for complaint ${created.id}:`, histErr.message);
        }

        return this._formatComplaint(created.toObject());
      } catch (err) {
        if (err.code === 11000 && attempt < maxRetries) {
          // Duplicate reference collided under race condition; retry with next sequence
          continue;
        }
        throw err;
      }
    }

    throw new Error('Failed to generate unique complaint reference number after multiple retries.');
  }

  /**
   * Update complaint status with strict transition validation and history logging.
   */
  async updateStatus(idOrRef, { status, remarks, actorType, resolutionDetails }) {
    const target = String(idOrRef).trim();
    const targetRegex = new RegExp(`^${target}$`, 'i');

    const doc = await ComplaintModel.findOne({
      $or: [{ id: targetRegex }, { referenceNumber: targetRegex }]
    });

    if (!doc) return null;

    const currentStatus = doc.status;
    const { valid, allowed } = validateStatusTransition(currentStatus, status);
    if (!valid) {
      const err = new Error(
        `Invalid status transition from '${currentStatus}' to '${status}'. Allowed transitions: ${allowed.join(', ')}`
      );
      err.status = 400;
      throw err;
    }

    const timestamp = new Date();
    doc.status = status;
    doc.updatedAt = timestamp;
    doc.lastUpdated = timestamp;
    if (resolutionDetails !== undefined) {
      doc.resolutionDetails = resolutionDetails;
    }

    const historyEntry = {
      timestamp,
      status,
      actorType: actorType || 'OFFICER',
      remarks: remarks || `Status changed from ${currentStatus} to ${status}`
    };
    if (resolutionDetails !== undefined) {
      historyEntry.resolutionDetails = resolutionDetails;
    }

    doc.statusHistory.push(historyEntry);
    await doc.save();

    // Log to StatusHistoryModel
    try {
      await StatusHistoryModel.create({
        id: `HIST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        complaintId: doc.id,
        referenceNumber: doc.referenceNumber,
        timestamp,
        status,
        actorType: actorType || 'OFFICER',
        remarks: historyEntry.remarks,
        resolutionDetails: resolutionDetails !== undefined ? resolutionDetails : null
      });
    } catch (histErr) {
      console.warn(`[Persistence Warning] Standalone StatusHistoryModel creation failed for complaint ${doc.id}:`, histErr.message);
    }

    return this._formatComplaint(doc.toObject());
  }

  /**
   * Reassign complaint department with validation and history logging.
   */
  async updateDepartment(idOrRef, { departmentId, remarks, actorType }) {
    const deptExists = await departmentRepository.exists(departmentId);
    if (!deptExists) {
      const err = new Error(`Invalid departmentId '${departmentId}'. Department does not exist.`);
      err.status = 400;
      throw err;
    }

    const target = String(idOrRef).trim();
    const targetRegex = new RegExp(`^${target}$`, 'i');

    const doc = await ComplaintModel.findOne({
      $or: [{ id: targetRegex }, { referenceNumber: targetRegex }]
    });

    if (!doc) return null;

    const previousDept = doc.departmentId || doc.department;
    const timestamp = new Date();

    doc.departmentId = departmentId;
    doc.department = departmentId;
    doc.reassignments = (doc.reassignments || 0) + 1;
    doc.updatedAt = timestamp;
    doc.lastUpdated = timestamp;

    const historyEntry = {
      timestamp,
      status: doc.status,
      actorType: actorType || 'OFFICER',
      remarks: remarks || `Reassigned from ${previousDept} to ${departmentId}`
    };

    doc.statusHistory.push(historyEntry);
    await doc.save();

    try {
      await StatusHistoryModel.create({
        id: `HIST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        complaintId: doc.id,
        referenceNumber: doc.referenceNumber,
        timestamp,
        status: doc.status,
        actorType: actorType || 'OFFICER',
        remarks: historyEntry.remarks
      });
    } catch (histErr) {
      console.warn(`[Persistence Warning] Standalone StatusHistoryModel creation failed for complaint ${doc.id}:`, histErr.message);
    }

    return this._formatComplaint(doc.toObject());
  }

  /**
   * Add internal officer review note.
   */
  async addOfficerNote(idOrRef, { note, officerId }) {
    const target = String(idOrRef).trim();
    const targetRegex = new RegExp(`^${target}$`, 'i');

    const doc = await ComplaintModel.findOne({
      $or: [{ id: targetRegex }, { referenceNumber: targetRegex }]
    });

    if (!doc) return null;

    const timestamp = new Date();
    doc.officerNotes.push({
      timestamp,
      note,
      officerId: officerId || 'OFFICER_ADMIN'
    });
    doc.updatedAt = timestamp;
    doc.lastUpdated = timestamp;

    await doc.save();
    return this._formatComplaint(doc.toObject());
  }

  /**
   * Update complaint priority with validation and history logging.
   */
  async updatePriority(idOrRef, { priority, remarks, actorType }) {
    if (!Object.values(COMPLAINT_PRIORITY).includes(priority)) {
      const err = new Error(`Invalid priority '${priority}'. Allowed priorities: ${Object.values(COMPLAINT_PRIORITY).join(', ')}`);
      err.status = 400;
      throw err;
    }

    const target = String(idOrRef).trim();
    const targetRegex = new RegExp(`^${target}$`, 'i');

    const doc = await ComplaintModel.findOne({
      $or: [{ id: targetRegex }, { referenceNumber: targetRegex }]
    });

    if (!doc) return null;

    const previousPriority = doc.priority || COMPLAINT_PRIORITY.MEDIUM;
    const timestamp = new Date();

    doc.priority = priority;
    doc.updatedAt = timestamp;
    doc.lastUpdated = timestamp;

    doc.statusHistory.push({
      timestamp,
      status: doc.status,
      actorType: actorType || 'OFFICER',
      remarks: remarks || `Priority updated from ${previousPriority} to ${priority}`
    });

    await doc.save();
    return this._formatComplaint(doc.toObject());
  }

  /**
   * Link complaint as duplicate of an existing parent complaint.
   */
  async linkDuplicate(idOrRef, { duplicateOf, remarks, actorType }) {
    const target = String(idOrRef).trim();
    const targetRegex = new RegExp(`^${target}$`, 'i');

    const doc = await ComplaintModel.findOne({
      $or: [{ id: targetRegex }, { referenceNumber: targetRegex }]
    });

    if (!doc) return null;

    const timestamp = new Date();
    doc.duplicateOf = duplicateOf;
    doc.updatedAt = timestamp;
    doc.lastUpdated = timestamp;

    doc.statusHistory.push({
      timestamp,
      status: doc.status,
      actorType: actorType || 'OFFICER',
      remarks: remarks || `Linked as potential duplicate of ${duplicateOf}`
    });

    await doc.save();
    return this._formatComplaint(doc.toObject());
  }

  /**
   * Link complaint to a parent incident.
   */
  async linkIncident(idOrRef, { incidentId, remarks, actorType } = {}) {
    const target = String(idOrRef).trim();
    const targetRegex = new RegExp(`^${target}$`, 'i');

    const doc = await ComplaintModel.findOne({
      $or: [{ id: targetRegex }, { referenceNumber: targetRegex }]
    });

    if (!doc) return null;

    // Idempotent: already linked to this exact incident
    if (doc.incidentId === incidentId) {
      return this._formatComplaint(doc.toObject());
    }

    // Conflict: already linked to a different incident - preserve existing link
    if (doc.incidentId && doc.incidentId !== incidentId) {
      const err = new Error(
        `Complaint '${idOrRef}' is already linked to incident '${doc.incidentId}'. Cannot re-link to '${incidentId}'.`
      );
      err.status = 409;
      err.code = 'CONFLICT';
      throw err;
    }

    const timestamp = new Date();
    doc.incidentId = incidentId;
    doc.updatedAt = timestamp;
    doc.lastUpdated = timestamp;

    doc.statusHistory.push({
      timestamp,
      status: doc.status,
      actorType: actorType || 'OFFICER',
      remarks: remarks || `Linked to parent incident ${incidentId}`
    });

    await doc.save();
    return this._formatComplaint(doc.toObject());
  }

  /**
   * Unlink complaint from its parent incident.
   */
  async unlinkIncident(idOrRef, { remarks, actorType } = {}) {
    const target = String(idOrRef).trim();
    const targetRegex = new RegExp(`^${target}$`, 'i');

    const doc = await ComplaintModel.findOne({
      $or: [{ id: targetRegex }, { referenceNumber: targetRegex }]
    });

    if (!doc) return null;

    // Idempotent: already unlinked
    if (!doc.incidentId) {
      return this._formatComplaint(doc.toObject());
    }

    const previousIncidentId = doc.incidentId;
    const timestamp = new Date();
    doc.incidentId = null;
    doc.updatedAt = timestamp;
    doc.lastUpdated = timestamp;

    doc.statusHistory.push({
      timestamp,
      status: doc.status,
      actorType: actorType || 'OFFICER',
      remarks: remarks || `Unlinked from parent incident ${previousIncidentId}`
    });

    await doc.save();
    return this._formatComplaint(doc.toObject());
  }

  /**
   * Update intelligence metadata on a complaint.
   */
  async updateIntelligence(idOrRef, intelligence) {
    const target = String(idOrRef).trim();
    const targetRegex = new RegExp(`^${target}$`, 'i');

    const doc = await ComplaintModel.findOne({
      $or: [{ id: targetRegex }, { referenceNumber: targetRegex }]
    });

    if (!doc) return null;

    const timestamp = new Date();
    doc.intelligence = intelligence;
    doc.updatedAt = timestamp;
    doc.lastUpdated = timestamp;

    await doc.save();
    return this._formatComplaint(doc.toObject());
  }

  /**
   * Retrieve status progression history
   */
  async getStatusHistory(idOrRef) {
    const target = String(idOrRef).trim();
    const historyDocs = await StatusHistoryModel.find({
      $or: [{ complaintId: target }, { referenceNumber: target }]
    })
      .sort({ timestamp: 1 })
      .lean();

    if (historyDocs && historyDocs.length > 0) {
      return historyDocs.map(h => ({
        id: h.id,
        complaintId: h.complaintId,
        referenceNumber: h.referenceNumber,
        timestamp: h.timestamp instanceof Date ? h.timestamp.toISOString() : String(h.timestamp),
        status: h.status,
        actorType: h.actorType,
        remarks: h.remarks
      }));
    }

    const complaint = await this.findById(idOrRef);
    return complaint?.statusHistory || [];
  }

  /**
   * Normalize Mongo document object to standard Plain Old JavaScript Object
   */
  _formatComplaint(raw) {
    if (!raw) return null;
    const formatted = { ...raw };
    delete formatted._id;
    delete formatted.__v;

    if (formatted.createdAt instanceof Date) {
      formatted.createdAt = formatted.createdAt.toISOString();
    }
    if (formatted.updatedAt instanceof Date) {
      formatted.updatedAt = formatted.updatedAt.toISOString();
    }
    if (formatted.lastUpdated instanceof Date) {
      formatted.lastUpdated = formatted.lastUpdated.toISOString();
    }

    if (Array.isArray(formatted.statusHistory)) {
      formatted.statusHistory = formatted.statusHistory.map(h => ({
        ...h,
        timestamp: h.timestamp instanceof Date ? h.timestamp.toISOString() : String(h.timestamp)
      }));
    }

    if (Array.isArray(formatted.officerNotes)) {
      formatted.officerNotes = formatted.officerNotes.map(n => ({
        ...n,
        timestamp: n.timestamp instanceof Date ? n.timestamp.toISOString() : String(n.timestamp)
      }));
    }

    formatted.citizenId = formatted.citizenId || 'SYNTHETIC_CPGRAMS_DEMO';
    formatted.assignedOfficerId = formatted.assignedOfficerId || null;
    formatted.intelligence = formatted.intelligence || null;
    formatted.duplicateOf = formatted.duplicateOf || null;
    formatted.resolutionDetails = formatted.resolutionDetails || null;

    return formatted;
  }
}

export const mongoComplaintRepository = new MongoComplaintRepository();
export default mongoComplaintRepository;
