import fs from 'fs/promises';
import config, { assertSafeWritePath } from '../config/app.config.js';
import {
  SUBTASK_STATUS,
  validateSubtaskStatusTransition
} from '../constants/incident.constants.js';

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
 * File-backed Subtask Repository (JSON storage).
 * Provides concurrency control via AsyncMutex and atomic file replacement.
 */
export class JsonSubtaskRepository {
  constructor(customFilePath = null) {
    this._customFilePath = customFilePath;
    this._mutex = new AsyncMutex();
  }

  get filePath() {
    return this._customFilePath || config.dataPath.subtasks;
  }

  set filePath(path) {
    this._customFilePath = path;
  }

  setFilePath(customPath) {
    this._customFilePath = customPath;
  }

  resetFilePath() {
    this._customFilePath = null;
  }

  async _readFile() {
    const raw = await fs.readFile(this.filePath, 'utf-8');
    return JSON.parse(raw);
  }

  async _writeFile(data) {
    assertSafeWritePath(this.filePath);
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
   * Generates unique sequence ID for subtasks: SUB-YYYY-XXX
   */
  generateSubtaskId(subtasks = [], targetYear = new Date().getFullYear()) {
    const yearStr = String(targetYear);
    const existingIds = new Set((subtasks || []).map(s => (s.id || '').toUpperCase()));

    let maxNum = 0;
    for (const sub of subtasks || []) {
      const match = (sub.id || '').match(/SUB-(\d{4})-(\d+)/i);
      if (match && match[1] === yearStr) {
        const num = parseInt(match[2], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }

    let candidateSeq = maxNum + 1;
    let candidateId = `SUB-${yearStr}-${String(candidateSeq).padStart(3, '0')}`;
    while (existingIds.has(candidateId.toUpperCase())) {
      candidateSeq++;
      candidateId = `SUB-${yearStr}-${String(candidateSeq).padStart(3, '0')}`;
    }

    return candidateId;
  }

  /**
   * Find subtasks with criteria filtering
   */
  async findAll(filters = {}) {
    const data = await this._readFile();
    let list = data.subtasks || [];

    // Filter by parent incident
    if (filters.incidentId) {
      list = list.filter(s => s.incidentId === filters.incidentId);
    }

    // Filter by complaint
    if (filters.complaintId) {
      list = list.filter(s => s.complaintId === filters.complaintId);
    }

    // Filter by department
    if (filters.department && filters.department !== 'ALL') {
      list = list.filter(s => s.department === filters.department);
    }

    // Filter by status
    if (filters.status && filters.status !== 'ALL') {
      list = list.filter(s => s.status === filters.status);
    }

    // Filter by assigned officer (checks both field names for backward compatibility)
    if (filters.assignedOfficerId || filters.officerId) {
      const targetOfficer = filters.assignedOfficerId || filters.officerId;
      list = list.filter(s => s.assignedOfficerId === targetOfficer || s.officerId === targetOfficer);
    }

    // Search in title, remarks
    if (filters.search && filters.search.trim() !== '') {
      const q = filters.search.trim().toLowerCase();
      list = list.filter(s =>
        s.id?.toLowerCase().includes(q) ||
        s.title?.toLowerCase().includes(q) ||
        s.remarks?.toLowerCase().includes(q)
      );
    }

    return list;
  }

  /**
   * Find subtask by ID (case-insensitive)
   */
  async findById(id) {
    if (!id) return null;
    const target = String(id).trim().toLowerCase();
    const data = await this._readFile();
    const subtask = (data.subtasks || []).find(s => s.id?.toLowerCase() === target);
    return subtask || null;
  }

  /**
   * Create new subtask
   */
  async create(subtaskData) {
    if (!subtaskData.incidentId || !subtaskData.title || !subtaskData.department) {
      const err = new Error('Subtask requires incidentId, title, and department');
      err.status = 400;
      throw err;
    }

    return this._mutex.run(async () => {
      const data = await this._readFile();
      if (!Array.isArray(data.subtasks)) {
        data.subtasks = [];
      }

      const id = subtaskData.id || this.generateSubtaskId(data.subtasks);
      const timestamp = new Date().toISOString();
      const officer = subtaskData.assignedOfficerId || subtaskData.officerId || null;

      const newSubtask = {
        id,
        incidentId: subtaskData.incidentId,
        complaintId: subtaskData.complaintId || null,
        title: subtaskData.title.trim(),
        department: subtaskData.department,
        assignedOfficerId: officer,
        officerId: officer, // Maintain compatibility
        status: subtaskData.status || SUBTASK_STATUS.PENDING,
        dueDate: subtaskData.dueDate || null,
        completedAt: subtaskData.completedAt || null,
        remarks: (subtaskData.remarks || '').trim(),
        synthetic: Boolean(subtaskData.synthetic),
        createdAt: subtaskData.createdAt || timestamp,
        updatedAt: subtaskData.updatedAt || timestamp
      };

      data.subtasks.push(newSubtask);
      await this._writeFile(data);
      return newSubtask;
    });
  }

  /**
   * Update subtask with status transition validation
   */
  async update(id, updateData) {
    return this._mutex.run(async () => {
      const data = await this._readFile();
      const target = String(id).trim().toLowerCase();
      const index = (data.subtasks || []).findIndex(s => s.id?.toLowerCase() === target);

      if (index === -1) return null;

      const current = data.subtasks[index];

      // Validate status transition if status is being updated
      if (updateData.status && updateData.status !== current.status) {
        const transition = validateSubtaskStatusTransition(current.status, updateData.status);
        if (!transition.valid) {
          const err = new Error(
            `Invalid subtask status transition from '${current.status}' to '${updateData.status}'. Allowed: ${transition.allowed.join(', ') || 'None'}`
          );
          err.status = 400;
          throw err;
        }
      }

      const timestamp = new Date().toISOString();
      const officer = updateData.assignedOfficerId !== undefined
        ? updateData.assignedOfficerId
        : (updateData.officerId !== undefined ? updateData.officerId : current.assignedOfficerId);

      const updated = {
        ...current,
        ...updateData,
        id: current.id, // Immutable
        incidentId: current.incidentId, // Immutable
        assignedOfficerId: officer,
        officerId: officer,
        updatedAt: timestamp
      };

      if (updateData.status === SUBTASK_STATUS.COMPLETED && !updated.completedAt) {
        updated.completedAt = timestamp;
      }

      data.subtasks[index] = updated;
      await this._writeFile(data);
      return updated;
    });
  }

  /**
   * Delete subtask by ID
   */
  async delete(id) {
    return this._mutex.run(async () => {
      const data = await this._readFile();
      const target = String(id).trim().toLowerCase();
      const originalLength = (data.subtasks || []).length;
      data.subtasks = (data.subtasks || []).filter(s => s.id?.toLowerCase() !== target);

      if (data.subtasks.length !== originalLength) {
        await this._writeFile(data);
        return true;
      }
      return false;
    });
  }

  /**
   * Count subtasks matching criteria
   */
  async count(filters = {}) {
    const all = await this.findAll(filters);
    return all.length;
  }
}

export const jsonSubtaskRepository = new JsonSubtaskRepository();
export default jsonSubtaskRepository;
