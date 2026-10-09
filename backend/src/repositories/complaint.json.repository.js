import fs from 'fs/promises';
import config from '../config/app.config.js';
import { COMPLAINT_STATUS, COMPLAINT_PRIORITY, validateStatusTransition } from '../constants/status.constants.js';
import departmentRepository from './department.repository.js';

/**
 * Lightweight in-process promise-chain mutex for serializing concurrent file writes.
 */
class AsyncMutex {
  constructor() {
    this._queue = Promise.resolve();
  }

  run(task) {
    const result = this._queue.then(() => task());
    this._queue = result.catch(() => {});
    return result;
  }
}

/**
 * File-backed Complaint Repository (JSON storage).
 * Provides atomic writes, mutex serialization, search/pagination, and status history tracking.
 */
export class JsonComplaintRepository {
  constructor(customFilePath = null) {
    this.filePath = customFilePath || config.dataPath.complaints;
    this._mutex = new AsyncMutex();
  }

  setFilePath(customPath) {
    this.filePath = customPath;
  }

  resetFilePath() {
    this.filePath = config.dataPath.complaints;
  }

  async _readFile() {
    const raw = await fs.readFile(this.filePath, 'utf-8');
    return JSON.parse(raw);
  }

  /**
   * Resilient atomic file write with temporary file and retry mechanism.
   * Prevents file corruption during concurrent operations or process interruption.
   */
  async _writeFile(data) {
    const content = JSON.stringify(data, null, 2);
    const tempPath = `${this.filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`;
    await fs.writeFile(tempPath, content, 'utf-8');

    let attempts = 0;
    while (attempts < 5) {
      try {
        await fs.rename(tempPath, this.filePath);
        return;
      } catch (err) {
        attempts++;
        if (attempts >= 5) {
          try { await fs.unlink(tempPath); } catch {}
          await fs.writeFile(this.filePath, content, 'utf-8');
          return;
        }
        await new Promise(r => setTimeout(r, 20 * attempts));
      }
    }
  }

  /**
   * Dynamic unique reference number generator.
   * Extracts maximum sequence number for the target year and increments safely.
   * Uses collision safety loop to ensure zero collisions with existing records.
   */
  generateReferenceNumber(complaints = [], targetYear = new Date().getFullYear()) {
    const yearStr = String(targetYear);
    const existingRefs = new Set(
      complaints.map(c => (c.referenceNumber || c.id || '').toUpperCase())
    );
    let maxNum = 0;

    for (const c of complaints) {
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
    const data = await this._readFile();
    let list = data.complaints || [];

    // Filter by Category
    if (filters.category && filters.category !== 'ALL') {
      list = list.filter(c => c.category?.toLowerCase() === filters.category.toLowerCase());
    }

    // Filter by Department
    if (filters.departmentId && filters.departmentId !== 'ALL') {
      list = list.filter(c => (c.departmentId === filters.departmentId || c.department === filters.departmentId));
    } else if (filters.department && filters.department !== 'ALL') {
      list = list.filter(c => (c.departmentId === filters.department || c.department === filters.department));
    }

    // Filter by Status
    if (filters.status && filters.status !== 'ALL') {
      list = list.filter(c => c.status === filters.status);
    }

    // Filter by Citizen Ownership
    if (filters.citizenId) {
      list = list.filter(c => (c.citizenId || 'SYNTHETIC_CPGRAMS_DEMO') === filters.citizenId);
    }

    // Filter by Priority
    if (filters.priority && filters.priority !== 'ALL') {
      list = list.filter(c => c.priority === filters.priority);
    }

    // Free text search
    if (filters.search && filters.search.trim() !== '') {
      const q = filters.search.trim().toLowerCase();
      list = list.filter(c =>
        c.id?.toLowerCase().includes(q) ||
        c.referenceNumber?.toLowerCase().includes(q) ||
        c.title?.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q) ||
        c.text?.toLowerCase().includes(q) ||
        c.category?.toLowerCase().includes(q) ||
        c.district?.toLowerCase().includes(q) ||
        c.locality?.toLowerCase().includes(q)
      );
    }

    // Sort order
    if (filters.sort) {
      if (filters.sort === 'createdAt_asc') {
        list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      } else if (filters.sort === 'createdAt_desc') {
        list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      } else if (filters.sort === 'priority_desc') {
        const pMap = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        list.sort((a, b) => (pMap[b.priority] || 0) - (pMap[a.priority] || 0));
      }
    } else {
      // Default: newest first
      list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    // Optional Pagination
    if (filters.page && filters.limit) {
      const page = Math.max(1, parseInt(filters.page, 10));
      const limit = Math.max(1, parseInt(filters.limit, 10));
      const total = list.length;
      const totalPages = Math.ceil(total / limit);
      const startIndex = (page - 1) * limit;
      const paginatedItems = list.slice(startIndex, startIndex + limit);

      return {
        items: paginatedItems,
        pagination: {
          total,
          page,
          limit,
          totalPages
        }
      };
    }

    return list;
  }

  /**
   * Find a complaint by ID or Reference Number (case-insensitive)
   */
  async findById(idOrRef) {
    if (!idOrRef) return null;
    const data = await this._readFile();
    const target = String(idOrRef).toLowerCase();

    const complaint = (data.complaints || []).find(c =>
      c.id?.toLowerCase() === target ||
      c.referenceNumber?.toLowerCase() === target
    );
    if (!complaint) return null;
    return {
      ...complaint,
      citizenId: complaint.citizenId || 'SYNTHETIC_CPGRAMS_DEMO'
    };
  }

  /**
   * Create a new complaint with concurrency-safe atomic insertion and dynamic year reference.
   */
  async create(complaintData, overrideYear = null) {
    return this._mutex.run(async () => {
      const data = await this._readFile();
      data.complaints = data.complaints || [];

      const targetYear = overrideYear || new Date().getFullYear();
      const nextRef = this.generateReferenceNumber(data.complaints, targetYear);
      const timestamp = new Date().toISOString();

      const newComplaint = {
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
        priority: COMPLAINT_PRIORITY.MEDIUM, // Neutral placeholder, not AI-assessed
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

      data.complaints.unshift(newComplaint);
      if (!data.metadata) data.metadata = { synthetic: false };
      data.metadata.total = data.complaints.length;

      await this._writeFile(data);
      return newComplaint;
    });
  }

  /**
   * Update complaint status with strict transition validation and history logging.
   * Serialized via mutex to prevent race conditions.
   */
  async updateStatus(idOrRef, { status, remarks, actorType }) {
    return this._mutex.run(async () => {
      const data = await this._readFile();
      const target = String(idOrRef).toLowerCase();
      const index = (data.complaints || []).findIndex(c =>
        c.id?.toLowerCase() === target ||
        c.referenceNumber?.toLowerCase() === target
      );

      if (index === -1) return null;

      const currentStatus = data.complaints[index].status;
      const { valid, allowed } = validateStatusTransition(currentStatus, status);
      if (!valid) {
        const err = new Error(
          `Invalid status transition from '${currentStatus}' to '${status}'. Allowed transitions: ${allowed.join(', ')}`
        );
        err.status = 400;
        throw err;
      }

      const timestamp = new Date().toISOString();
      data.complaints[index].status = status;
      data.complaints[index].updatedAt = timestamp;
      data.complaints[index].lastUpdated = timestamp;

      const historyEntry = {
        timestamp,
        status,
        actorType: actorType || 'OFFICER',
        remarks: remarks || `Status changed from ${currentStatus} to ${status}`
      };

      if (!Array.isArray(data.complaints[index].statusHistory)) {
        data.complaints[index].statusHistory = [];
      }
      data.complaints[index].statusHistory.push(historyEntry);

      await this._writeFile(data);
      return data.complaints[index];
    });
  }

  /**
   * Reassign complaint department with validation and history logging.
   * Serialized via mutex to prevent race conditions.
   */
  async updateDepartment(idOrRef, { departmentId, remarks, actorType }) {
    const deptExists = await departmentRepository.exists(departmentId);
    if (!deptExists) {
      const err = new Error(`Invalid departmentId '${departmentId}'. Department does not exist.`);
      err.status = 400;
      throw err;
    }

    return this._mutex.run(async () => {
      const data = await this._readFile();
      const target = String(idOrRef).toLowerCase();
      const index = (data.complaints || []).findIndex(c =>
        c.id?.toLowerCase() === target ||
        c.referenceNumber?.toLowerCase() === target
      );

      if (index === -1) return null;

      const previousDept = data.complaints[index].departmentId || data.complaints[index].department;
      const timestamp = new Date().toISOString();

      data.complaints[index].departmentId = departmentId;
      data.complaints[index].department = departmentId;
      data.complaints[index].reassignments = (data.complaints[index].reassignments || 0) + 1;
      data.complaints[index].updatedAt = timestamp;
      data.complaints[index].lastUpdated = timestamp;

      if (!Array.isArray(data.complaints[index].statusHistory)) {
        data.complaints[index].statusHistory = [];
      }
      data.complaints[index].statusHistory.push({
        timestamp,
        status: data.complaints[index].status,
        actorType: actorType || 'OFFICER',
        remarks: remarks || `Reassigned from ${previousDept} to ${departmentId}`
      });

      await this._writeFile(data);
      return data.complaints[index];
    });
  }

  /**
   * Add internal officer review note.
   * Serialized via mutex to prevent race conditions.
   */
  async addOfficerNote(idOrRef, { note, officerId }) {
    return this._mutex.run(async () => {
      const data = await this._readFile();
      const target = String(idOrRef).toLowerCase();
      const index = (data.complaints || []).findIndex(c =>
        c.id?.toLowerCase() === target ||
        c.referenceNumber?.toLowerCase() === target
      );

      if (index === -1) return null;

      const timestamp = new Date().toISOString();
      const noteEntry = {
        timestamp,
        note,
        officerId: officerId || 'OFFICER_ADMIN'
      };

      if (!Array.isArray(data.complaints[index].officerNotes)) {
        data.complaints[index].officerNotes = [];
      }
      data.complaints[index].officerNotes.push(noteEntry);
      data.complaints[index].updatedAt = timestamp;

      await this._writeFile(data);
      return data.complaints[index];
    });
  }

  /**
   * Retrieve status progression history
   */
  async getStatusHistory(idOrRef) {
    const complaint = await this.findById(idOrRef);
    if (!complaint) return null;
    return complaint.statusHistory || [];
  }
}

export const jsonComplaintRepository = new JsonComplaintRepository();
export default jsonComplaintRepository;
