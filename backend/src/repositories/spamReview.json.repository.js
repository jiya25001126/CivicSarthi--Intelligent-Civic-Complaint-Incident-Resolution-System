import fs from 'fs/promises';
import config, { assertSafeWritePath } from '../config/app.config.js';
import { SPAM_REVIEW_STATUS } from '../constants/spam.constants.js';

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

export class JsonSpamReviewRepository {
  constructor(customFilePath = null) {
    this._customFilePath = customFilePath;
    this._mutex = new AsyncMutex();
  }

  get filePath() {
    return this._customFilePath || config.dataPath.spamReviews;
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
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      return JSON.parse(raw);
    } catch (err) {
      if (err.code === 'ENOENT') {
        const initial = {
          metadata: { version: '1.0.0', description: 'CivicSarthi Flagged Spam & Suspicious Complaint Review Queue' },
          spamReviews: []
        };
        await this._writeFile(initial);
        return initial;
      }
      throw err;
    }
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

  generateReviewId(existingList = [], targetYear = null) {
    const year = targetYear || new Date().getFullYear();
    const prefix = `REV-${year}-`;
    const seqs = existingList
      .filter((r) => r.id && r.id.startsWith(prefix))
      .map((r) => {
        const match = r.id.match(/^REV-\d{4}-(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      });
    const nextSeq = seqs.length > 0 ? Math.max(...seqs) + 1 : 1;
    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  async create(data) {
    return this._mutex.run(async () => {
      const fileData = await this._readFile();
      const list = fileData.spamReviews || [];

      const id = data.id || this.generateReviewId(list);
      const now = new Date().toISOString();

      const newRecord = {
        ...data,
        id,
        reviewStatus: data.reviewStatus || SPAM_REVIEW_STATUS.PENDING,
        decision: data.decision || null,
        reviewHistory: data.reviewHistory || [],
        evaluatedAt: data.evaluatedAt || now,
        createdAt: data.createdAt || now,
        updatedAt: now
      };

      list.push(newRecord);
      fileData.spamReviews = list;
      await this._writeFile(fileData);
      return { ...newRecord };
    });
  }

  async findById(id) {
    if (!id) return null;
    const fileData = await this._readFile();
    const list = fileData.spamReviews || [];
    const target = String(id).trim().toLowerCase();
    const found = list.find((r) => r.id && r.id.toLowerCase() === target);
    return found ? { ...found } : null;
  }

  async findByComplaintId(complaintId) {
    if (!complaintId) return null;
    const fileData = await this._readFile();
    const list = fileData.spamReviews || [];
    const target = String(complaintId).trim().toLowerCase();
    const found = list.find(
      (r) =>
        (r.complaintId && r.complaintId.toLowerCase() === target) ||
        (r.complaintReference && r.complaintReference.toLowerCase() === target)
    );
    return found ? { ...found } : null;
  }

  async findAll(filters = {}) {
    const fileData = await this._readFile();
    let list = fileData.spamReviews || [];

    if (filters.departmentId) {
      const targetDept = String(filters.departmentId).trim().toUpperCase();
      list = list.filter((r) => r.departmentId && r.departmentId.toUpperCase() === targetDept);
    }

    const statusVal = filters.reviewStatus || filters.status;
    if (statusVal && statusVal !== 'ALL') {
      const normalized = (statusVal === 'PENDING_REVIEW' || statusVal === 'PENDING')
        ? ['PENDING', 'PENDING_REVIEW']
        : (statusVal === 'RESOLVED' || statusVal === 'REVIEWED')
          ? ['REVIEWED', 'RESOLVED']
          : [statusVal];
      list = list.filter((r) => normalized.includes(r.reviewStatus));
    }

    if (filters.riskLevel && filters.riskLevel !== 'ALL') {
      list = list.filter((r) => r.riskLevel === filters.riskLevel);
    }

    if (filters.citizenId) {
      list = list.filter((r) => r.citizenId === filters.citizenId);
    }

    if (filters.complaintId) {
      const targetCmp = String(filters.complaintId).trim().toLowerCase();
      list = list.filter(
        (r) =>
          (r.complaintId && r.complaintId.toLowerCase() === targetCmp) ||
          (r.complaintReference && r.complaintReference.toLowerCase() === targetCmp)
      );
    }

    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return list.map((item) => ({ ...item }));
  }

  async update(id, updates) {
    return this._mutex.run(async () => {
      const fileData = await this._readFile();
      const list = fileData.spamReviews || [];
      const idx = list.findIndex((r) => r.id === id);
      if (idx === -1) return null;

      const updated = {
        ...list[idx],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      list[idx] = updated;
      fileData.spamReviews = list;
      await this._writeFile(fileData);
      return { ...updated };
    });
  }

  async recordDecision(id, { outcome, reason, reviewerId, reviewerRole }) {
    return this._mutex.run(async () => {
      const fileData = await this._readFile();
      const list = fileData.spamReviews || [];
      const idx = list.findIndex((r) => r.id === id);
      if (idx === -1) return null;

      const current = list[idx];
      const now = new Date().toISOString();

      const decisionObj = {
        outcome,
        reason,
        reviewerId: reviewerId || 'OFFICER',
        reviewerRole: reviewerRole || 'officer',
        decidedAt: now
      };

      const historyEntry = {
        action: 'HUMAN_REVIEW_DECISION',
        outcome,
        reason,
        actorId: reviewerId || 'OFFICER',
        actorRole: reviewerRole || 'officer',
        timestamp: now
      };

      const updated = {
        ...current,
        reviewStatus: SPAM_REVIEW_STATUS.REVIEWED,
        decision: decisionObj,
        reviewHistory: [...(current.reviewHistory || []), historyEntry],
        updatedAt: now
      };

      list[idx] = updated;
      fileData.spamReviews = list;
      await this._writeFile(fileData);
      return { ...updated };
    });
  }
}

export const jsonSpamReviewRepository = new JsonSpamReviewRepository();
