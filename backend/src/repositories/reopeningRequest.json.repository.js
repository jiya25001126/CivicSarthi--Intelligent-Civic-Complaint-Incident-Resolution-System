import fs from 'fs/promises';
import config from '../config/app.config.js';
import {
  REOPENING_STATUS,
  validateReopeningStatusTransition
} from '../constants/feedback.constants.js';

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

export class JsonReopeningRequestRepository {
  constructor(customFilePath = null) {
    this.filePath = customFilePath || config.dataPath.reopeningRequests;
    this._mutex = new AsyncMutex();
  }

  setFilePath(customPath) {
    this.filePath = customPath;
  }

  resetFilePath() {
    this.filePath = config.dataPath.reopeningRequests;
  }

  async _readFile() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      return JSON.parse(raw);
    } catch (err) {
      if (err.code === 'ENOENT') {
        const initial = {
          metadata: { version: '1.0.0', description: 'CivicSarthi Controlled Reopening Requests' },
          reopeningRequests: []
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

  generateRequestId(existingList = [], targetYear = null) {
    const year = targetYear || new Date().getFullYear();
    const prefix = `REOPEN-${year}-`;
    const seqs = existingList
      .filter((r) => r.id && r.id.startsWith(prefix))
      .map((r) => {
        const match = r.id.match(/^REOPEN-\d{4}-(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      });
    const nextSeq = seqs.length > 0 ? Math.max(...seqs) + 1 : 1;
    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  generateRequestReference(existingList = [], targetYear = null) {
    const year = targetYear || new Date().getFullYear();
    const prefix = `REQ-${year}-`;
    const seqs = existingList
      .filter((r) => r.referenceNumber && r.referenceNumber.startsWith(prefix))
      .map((r) => {
        const match = r.referenceNumber.match(/^REQ-\d{4}-(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      });
    const nextSeq = seqs.length > 0 ? Math.max(...seqs) + 1 : 1;
    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  async create(data) {
    return this._mutex.run(async () => {
      const fileData = await this._readFile();
      const list = fileData.reopeningRequests || [];

      const id = data.id || this.generateRequestId(list);
      const referenceNumber = data.referenceNumber || this.generateRequestReference(list);
      const now = new Date().toISOString();

      const initialStatus = data.status || REOPENING_STATUS.PENDING_REVIEW;
      const initialHistory = data.statusHistory || [
        {
          status: initialStatus,
          timestamp: now,
          actorId: data.requesterId || 'SYSTEM',
          actorRole: 'citizen',
          remarks: 'Reopening request submitted by citizen complainant'
        }
      ];

      const newRecord = {
        ...data,
        id,
        referenceNumber,
        status: initialStatus,
        statusHistory: initialHistory,
        decision: data.decision || null,
        createdAt: data.createdAt || now,
        updatedAt: now
      };

      list.push(newRecord);
      fileData.reopeningRequests = list;
      await this._writeFile(fileData);
      return { ...newRecord };
    });
  }

  async findById(idOrRef) {
    if (!idOrRef) return null;
    const fileData = await this._readFile();
    const list = fileData.reopeningRequests || [];
    const target = String(idOrRef).trim().toLowerCase();
    const found = list.find((r) => (r.id && r.id.toLowerCase() === target) || (r.referenceNumber && r.referenceNumber.toLowerCase() === target));
    return found ? { ...found } : null;
  }

  async findPendingByComplaintId(complaintId) {
    const fileData = await this._readFile();
    const list = fileData.reopeningRequests || [];
    const found = list.find(
      (r) =>
        (r.complaintId === complaintId || r.complaintReference === complaintId) &&
        r.status === REOPENING_STATUS.PENDING_REVIEW
    );
    return found ? { ...found } : null;
  }

  async findAll(filters = {}) {
    const fileData = await this._readFile();
    let list = fileData.reopeningRequests || [];

    if (filters.complaintId) {
      list = list.filter(
        (r) => r.complaintId === filters.complaintId || r.complaintReference === filters.complaintId
      );
    }
    if (filters.requesterId) {
      list = list.filter((r) => r.requesterId === filters.requesterId || r.citizenId === filters.requesterId);
    }
    if (filters.departmentId && filters.departmentId !== 'ALL') {
      list = list.filter((r) => r.departmentId === filters.departmentId);
    }
    if (filters.status && filters.status !== 'ALL') {
      list = list.filter((r) => r.status === filters.status);
    }

    return list.map((r) => ({ ...r }));
  }

  async update(id, updates) {
    return this._mutex.run(async () => {
      const fileData = await this._readFile();
      const list = fileData.reopeningRequests || [];
      const idx = list.findIndex((r) => r.id === id || r.referenceNumber === id);
      if (idx === -1) return null;

      const updated = {
        ...list[idx],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      list[idx] = updated;
      fileData.reopeningRequests = list;
      await this._writeFile(fileData);
      return { ...updated };
    });
  }

  async recordDecision(id, { outcome, decision, reason, decisionReason, reviewerId, actorRole }) {
    return this._mutex.run(async () => {
      const fileData = await this._readFile();
      const list = fileData.reopeningRequests || [];
      const idx = list.findIndex((r) => r.id === id || r.referenceNumber === id);
      if (idx === -1) return null;

      const current = list[idx];
      const finalOutcome = outcome || decision;
      const targetStatus =
        finalOutcome === 'APPROVED' ? REOPENING_STATUS.APPROVED : REOPENING_STATUS.REJECTED;

      const { valid, allowed } = validateReopeningStatusTransition(current.status, targetStatus);
      if (!valid) {
        const err = new Error(
          `Invalid reopening status transition from '${current.status}' to '${targetStatus}'. Allowed: ${allowed.join(', ')}`
        );
        err.status = 400;
        err.code = 'INVALID_REOPENING_TRANSITION';
        throw err;
      }

      const now = new Date().toISOString();
      const finalReason = reason || decisionReason || '';
      const decisionObj = {
        outcome: finalOutcome,
        reason: finalReason,
        reviewerId: reviewerId || 'OFFICER',
        decidedAt: now
      };

      const historyEntry = {
        status: targetStatus,
        timestamp: now,
        actorId: reviewerId || 'OFFICER',
        actorRole: actorRole || 'officer',
        remarks: `Reopening request ${finalOutcome}: ${finalReason}`
      };

      const updated = {
        ...current,
        status: targetStatus,
        decision: decisionObj,
        statusHistory: [...(current.statusHistory || []), historyEntry],
        updatedAt: now
      };

      list[idx] = updated;
      fileData.reopeningRequests = list;
      await this._writeFile(fileData);
      return { ...updated };
    });
  }
}

export const jsonReopeningRequestRepository = new JsonReopeningRequestRepository();
