import fs from 'fs/promises';
import config from '../config/app.config.js';

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

export class JsonFeedbackRepository {
  constructor(customFilePath = null) {
    this.filePath = customFilePath || config.dataPath.feedback;
    this._mutex = new AsyncMutex();
  }

  setFilePath(customPath) {
    this.filePath = customPath;
  }

  resetFilePath() {
    this.filePath = config.dataPath.feedback;
  }

  async _readFile() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      return JSON.parse(raw);
    } catch (err) {
      if (err.code === 'ENOENT') {
        const initial = {
          metadata: { version: '1.0.0', description: 'CivicSarthi Citizen Resolution Feedback Records' },
          feedback: []
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

  generateFeedbackId(existingList = [], targetYear = null) {
    const year = targetYear || new Date().getFullYear();
    const prefix = `FB-${year}-`;
    const seqs = existingList
      .filter((f) => f.id && f.id.startsWith(prefix))
      .map((f) => {
        const match = f.id.match(/^FB-\d{4}-(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      });
    const nextSeq = seqs.length > 0 ? Math.max(...seqs) + 1 : 1;
    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  async create(data) {
    return this._mutex.run(async () => {
      const fileData = await this._readFile();
      const list = fileData.feedback || [];

      const id = data.id || this.generateFeedbackId(list);
      const now = new Date().toISOString();

      const newRecord = {
        ...data,
        id,
        createdAt: data.createdAt || now,
        updatedAt: now,
        isEdited: Boolean(data.isEdited),
        editHistory: data.editHistory || []
      };

      list.push(newRecord);
      fileData.feedback = list;
      await this._writeFile(fileData);
      return { ...newRecord };
    });
  }

  async findById(id) {
    const fileData = await this._readFile();
    const list = fileData.feedback || [];
    const found = list.find((f) => f.id === id);
    return found ? { ...found } : null;
  }

  async findByComplaintAndMilestone(complaintId, milestone) {
    const fileData = await this._readFile();
    const list = fileData.feedback || [];
    const strMilestone = String(milestone || '1');
    const target = String(complaintId || '').toLowerCase().trim();
    const found = list.find(
      (f) =>
        (String(f.complaintId || '').toLowerCase().trim() === target ||
         String(f.complaintReference || '').toLowerCase().trim() === target ||
         String(f.referenceNumber || '').toLowerCase().trim() === target) &&
        String(f.resolutionMilestone || '1') === strMilestone
    );
    return found ? { ...found } : null;
  }

  async findAll(filters = {}) {
    const fileData = await this._readFile();
    let list = fileData.feedback || [];

    if (filters.complaintId) {
      const target = String(filters.complaintId).toLowerCase().trim();
      list = list.filter(
        (f) =>
          String(f.complaintId || '').toLowerCase().trim() === target ||
          String(f.complaintReference || '').toLowerCase().trim() === target ||
          String(f.referenceNumber || '').toLowerCase().trim() === target
      );
    }
    if (filters.citizenId) {
      list = list.filter((f) => f.citizenId === filters.citizenId);
    }
    if (filters.departmentId) {
      list = list.filter((f) => f.departmentId === filters.departmentId);
    }
    if (filters.rating) {
      const r = Number(filters.rating);
      list = list.filter((f) => f.rating === r);
    }

    return list.map((f) => ({ ...f }));
  }

  async update(id, updates) {
    return this._mutex.run(async () => {
      const fileData = await this._readFile();
      const list = fileData.feedback || [];
      const idx = list.findIndex((f) => f.id === id);
      if (idx === -1) return null;

      const updated = {
        ...list[idx],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      list[idx] = updated;
      fileData.feedback = list;
      await this._writeFile(fileData);
      return { ...updated };
    });
  }
}

export const jsonFeedbackRepository = new JsonFeedbackRepository();
