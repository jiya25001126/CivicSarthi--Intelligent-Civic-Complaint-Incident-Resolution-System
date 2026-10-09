import fs from 'fs/promises';
import config from '../config/app.config.js';
import { COMPLAINT_STATUS, COMPLAINT_PRIORITY, validateStatusTransition } from '../constants/status.constants.js';
import departmentRepository from './department.repository.js';

/**
 * File-backed Complaint Repository.
 * Abstracted so that MongoDB / Mongoose can easily replace this implementation
 * in a subsequent phase without changing services or controllers.
 */
class ComplaintRepository {
  constructor() {
    this.filePath = config.dataPath.complaints;
  }

  async _readFile() {
    const raw = await fs.readFile(this.filePath, 'utf-8');
    return JSON.parse(raw);
  }

  async _writeFile(data) {
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
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
    return complaint || null;
  }

  /**
   * Create a new complaint with guaranteed unique reference number
   */
  async create(complaintData) {
    const data = await this._readFile();
    data.complaints = data.complaints || [];

    // Generate unique reference number: JAN-2026-XXXX
    let maxNum = 0;
    for (const c of data.complaints) {
      const match = (c.referenceNumber || c.id || '').match(/JAN-2026-(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    const nextRef = `JAN-2026-${String(maxNum + 1).padStart(4, '0')}`;
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
      evidence: Array.isArray(complaintData.evidence) ? complaintData.evidence : [],
      statusHistory: [
        {
          timestamp,
          status: COMPLAINT_STATUS.SUBMITTED,
          actorType: 'CITIZEN',
          remarks: 'Complaint registered in citizen portal'
        }
      ],
      officerNotes: [],
      synthetic: true
    };

    data.complaints.unshift(newComplaint);
    if (!data.metadata) data.metadata = { synthetic: true };
    data.metadata.total = data.complaints.length;

    await this._writeFile(data);
    return newComplaint;
  }

  /**
   * Update complaint status with strict transition validation and history logging
   */
  async updateStatus(idOrRef, { status, remarks, actorType }) {
    const data = await this._readFile();
    const target = String(idOrRef).toLowerCase();
    const index = (data.complaints || []).findIndex(c =>
      c.id?.toLowerCase() === target ||
      c.referenceNumber?.toLowerCase() === target
    );

    if (index === -1) return null;

    const current = data.complaints[index];
    const transitionCheck = validateStatusTransition(current.status, status);

    if (!transitionCheck.valid) {
      const err = new Error(`Invalid status transition from '${current.status}' to '${status}'. Allowed transitions: ${transitionCheck.allowed.join(', ') || 'None'}`);
      err.status = 400;
      err.allowed = transitionCheck.allowed;
      throw err;
    }

    const timestamp = new Date().toISOString();
    const historyEntry = {
      timestamp,
      status,
      actorType: actorType || 'OFFICER',
      remarks: remarks || `Status transitioned to ${status}`
    };

    data.complaints[index].status = status;
    data.complaints[index].updatedAt = timestamp;
    data.complaints[index].lastUpdated = timestamp;

    if (!Array.isArray(data.complaints[index].statusHistory)) {
      data.complaints[index].statusHistory = [];
    }
    data.complaints[index].statusHistory.push(historyEntry);

    await this._writeFile(data);
    return data.complaints[index];
  }

  /**
   * Reassign complaint department with validation and history logging
   */
  async updateDepartment(idOrRef, { departmentId, remarks, actorType }) {
    // Validate target department exists
    const deptExists = await departmentRepository.exists(departmentId);
    if (!deptExists) {
      const err = new Error(`Invalid departmentId '${departmentId}'. Department does not exist.`);
      err.status = 400;
      throw err;
    }

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
  }

  /**
   * Add internal officer review note
   */
  async addOfficerNote(idOrRef, { note, officerId }) {
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

export const complaintRepository = new ComplaintRepository();
export default complaintRepository;
