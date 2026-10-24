import fs from 'fs/promises';
import config from '../config/app.config.js';
import { APPEAL_STATUS, validateAppealStatusTransition } from '../constants/feedback.constants.js';

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

export class JsonAppealRepository {
  constructor(customFilePath = null) {
    this.filePath = customFilePath || config.dataPath.appeals;
    this._mutex = new AsyncMutex();
  }

  setFilePath(customPath) {
    this.filePath = customPath;
  }

  resetFilePath() {
    this.filePath = config.dataPath.appeals;
  }

  async _readFile() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      return JSON.parse(raw);
    } catch (err) {
      if (err.code === 'ENOENT') {
        const initial = {
          metadata: { version: '1.0.0', description: 'CivicSarthi Formal Resolution Appeals' },
          appeals: []
        };
        await this._writeFile(initial);
        return initial;
      }
      throw err;
    }
  }

  async _writeFile(data) {
    const content = JSON.stringify(data, null, 2);
    const tempPath = `${this.filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`;
    await fs.writeFile(tempPath, content, 'utf-8');

    let attempts = 0;
    while (attempts < 5) {
      try {
        await fs.rename(tempPath, this.filePath);
        return;
      } catch {
        attempts++;
        if (attempts >= 5) {
          try { await fs.unlink(tempPath); } catch {}
          await fs.writeFile(this.filePath, content, 'utf-8');
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    }
  }

  generateAppealId(existingList = [], targetYear = null) {
    const year = targetYear || new Date().getFullYear();
    const prefix = `APP-${year}-`;
    const seqs = existingList
      .filter((a) => a.id && a.id.startsWith(prefix))
      .map((a) => {
        const match = a.id.match(/^APP-\d{4}-(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      });
    const nextSeq = seqs.length > 0 ? Math.max(...seqs) + 1 : 1;
    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  generateAppealReference(existingList = [], targetYear = null) {
    const year = targetYear || new Date().getFullYear();
    const prefix = `APL-${year}-`;
    const seqs = existingList
      .filter((a) => a.referenceNumber && a.referenceNumber.startsWith(prefix))
      .map((a) => {
        const match = a.referenceNumber.match(/^APL-\d{4}-(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      });
    const nextSeq = seqs.length > 0 ? Math.max(...seqs) + 1 : 1;
    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  async create(data) {
    return this._mutex.run(async () => {
      const fileData = await this._readFile();
      const list = fileData.appeals || [];

      const id = data.id || this.generateAppealId(list);
      const referenceNumber = data.referenceNumber || this.generateAppealReference(list);
      const now = new Date().toISOString();

      const initialStatus = data.status || APPEAL_STATUS.SUBMITTED;
      const initialHistory = data.statusHistory || [
        {
          status: initialStatus,
          timestamp: now,
          actorId: data.requesterId || 'SYSTEM',
          actorRole: 'citizen',
          remarks: 'Appeal officially registered by citizen complainant'
        }
      ];

      const newRecord = {
        ...data,
        id,
        referenceNumber,
        status: initialStatus,
        statusHistory: initialHistory,
        internalNotes: data.internalNotes || [],
        decision: data.decision || null,
        createdAt: data.createdAt || now,
        updatedAt: now
      };

      list.push(newRecord);
      fileData.appeals = list;
      await this._writeFile(fileData);
      return { ...newRecord };
    });
  }

  async findById(idOrRef) {
    if (!idOrRef) return null;
    const fileData = await this._readFile();
    const list = fileData.appeals || [];
    const target = String(idOrRef).trim().toLowerCase();
    const found = list.find((a) => (a.id && a.id.toLowerCase() === target) || (a.referenceNumber && a.referenceNumber.toLowerCase() === target));
    return found ? { ...found } : null;
  }

  async findAll(filters = {}) {
    const fileData = await this._readFile();
    let list = fileData.appeals || [];

    if (filters.complaintId) {
      list = list.filter(
        (a) => a.complaintId === filters.complaintId || a.complaintReference === filters.complaintId
      );
    }
    if (filters.requesterId) {
      list = list.filter((a) => a.requesterId === filters.requesterId || a.citizenId === filters.requesterId);
    }
    if (filters.departmentId && filters.departmentId !== 'ALL') {
      list = list.filter((a) => a.departmentId === filters.departmentId);
    }
    if (filters.status && filters.status !== 'ALL') {
      list = list.filter((a) => a.status === filters.status);
    }
    if (filters.assignedReviewerId) {
      list = list.filter((a) => a.assignedReviewerId === filters.assignedReviewerId);
    }

    return list.map((a) => ({ ...a }));
  }

  async update(id, updates) {
    return this._mutex.run(async () => {
      const fileData = await this._readFile();
      const list = fileData.appeals || [];
      const idx = list.findIndex((a) => a.id === id || a.referenceNumber === id);
      if (idx === -1) return null;

      const updated = {
        ...list[idx],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      list[idx] = updated;
      fileData.appeals = list;
      await this._writeFile(fileData);
      return { ...updated };
    });
  }

  async updateStatus(id, { status, remarks, actorId, actorRole }) {
    return this._mutex.run(async () => {
      const fileData = await this._readFile();
      const list = fileData.appeals || [];
      const idx = list.findIndex((a) => a.id === id || a.referenceNumber === id);
      if (idx === -1) return null;

      const current = list[idx];
      const { valid, allowed } = validateAppealStatusTransition(current.status, status);
      if (!valid) {
        const err = new Error(
          `Invalid appeal status transition from '${current.status}' to '${status}'. Allowed: ${allowed.join(', ')}`
        );
        err.status = 400;
        err.code = 'INVALID_APPEAL_TRANSITION';
        throw err;
      }

      const now = new Date().toISOString();
      const historyEntry = {
        status,
        timestamp: now,
        actorId: actorId || 'SYSTEM',
        actorRole: actorRole || 'officer',
        remarks: remarks || `Appeal status updated to ${status}`
      };

      const updated = {
        ...current,
        status,
        statusHistory: [...(current.statusHistory || []), historyEntry],
        updatedAt: now
      };

      list[idx] = updated;
      fileData.appeals = list;
      await this._writeFile(fileData);
      return { ...updated };
    });
  }

  async addInternalNote(id, { note, officerId }) {
    return this._mutex.run(async () => {
      const fileData = await this._readFile();
      const list = fileData.appeals || [];
      const idx = list.findIndex((a) => a.id === id || a.referenceNumber === id);
      if (idx === -1) return null;

      const current = list[idx];
      const noteEntry = {
        note,
        officerId: officerId || 'OFFICER',
        createdAt: new Date().toISOString()
      };

      const updated = {
        ...current,
        internalNotes: [...(current.internalNotes || []), noteEntry],
        updatedAt: new Date().toISOString()
      };

      list[idx] = updated;
      fileData.appeals = list;
      await this._writeFile(fileData);
      return { ...updated };
    });
  }

  async recordDecision(id, { outcome, reason, reviewerId, actorRole }) {
    return this._mutex.run(async () => {
      const fileData = await this._readFile();
      const list = fileData.appeals || [];
      const idx = list.findIndex((a) => a.id === id || a.referenceNumber === id);
      if (idx === -1) return null;

      const current = list[idx];
      const targetStatus = outcome === 'UPHELD' ? APPEAL_STATUS.UPHELD : APPEAL_STATUS.REJECTED;

      const { valid, allowed } = validateAppealStatusTransition(current.status, targetStatus);
      if (!valid) {
        const err = new Error(
          `Invalid appeal status transition from '${current.status}' to '${targetStatus}'. Allowed: ${allowed.join(', ')}`
        );
        err.status = 400;
        err.code = 'INVALID_APPEAL_TRANSITION';
        throw err;
      }

      const now = new Date().toISOString();
      const decisionObj = {
        outcome,
        reason,
        reviewerId: reviewerId || 'OFFICER',
        decidedAt: now
      };

      const historyEntry = {
        status: targetStatus,
        timestamp: now,
        actorId: reviewerId || 'OFFICER',
        actorRole: actorRole || 'officer',
        remarks: `Appeal ${outcome}: ${reason}`
      };

      const updated = {
        ...current,
        status: targetStatus,
        decision: decisionObj,
        statusHistory: [...(current.statusHistory || []), historyEntry],
        updatedAt: now
      };

      list[idx] = updated;
      fileData.appeals = list;
      await this._writeFile(fileData);
      return { ...updated };
    });
  }
}

export const jsonAppealRepository = new JsonAppealRepository();
