import fs from 'fs/promises';
import config from '../config/app.config.js';
import { REMINDER_STATUS } from '../constants/clarification.constants.js';

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

export class JsonReminderRepository {
  constructor(customFilePath = null) {
    this.filePath = customFilePath || config.dataPath.reminders;
    this._mutex = new AsyncMutex();
  }

  setFilePath(customPath) {
    this.filePath = customPath;
  }

  resetFilePath() {
    this.filePath = config.dataPath.reminders;
  }

  async _readFile() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      return JSON.parse(raw);
    } catch (err) {
      if (err.code === 'ENOENT') {
        const initial = {
          metadata: { version: '1.0.0', description: 'CivicSarthi Citizen Grievance Reminders and Follow-up Log' },
          reminders: []
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

  generateReminderId(existingList = [], targetYear = null) {
    const year = targetYear || new Date().getFullYear();
    const prefix = `REM-${year}-`;
    const seqs = existingList
      .filter((r) => r.id && r.id.startsWith(prefix))
      .map((r) => {
        const match = r.id.match(/^REM-\d{4}-(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      });
    const nextSeq = seqs.length > 0 ? Math.max(...seqs) + 1 : 1;
    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  async create(data) {
    return this._mutex.run(async () => {
      const fileData = await this._readFile();
      const list = fileData.reminders || [];

      const id = data.id || this.generateReminderId(list);
      const now = new Date().toISOString();

      const newRecord = {
        ...data,
        id,
        status: data.status || REMINDER_STATUS.ACCEPTED,
        requestedAt: data.requestedAt || now,
        createdAt: data.createdAt || now,
        updatedAt: now
      };

      list.push(newRecord);
      fileData.reminders = list;
      await this._writeFile(fileData);
      return { ...newRecord };
    });
  }

  async findById(id) {
    if (!id) return null;
    const fileData = await this._readFile();
    const list = fileData.reminders || [];
    const target = String(id).trim().toLowerCase();
    const found = list.find((r) => r.id && r.id.toLowerCase() === target);
    return found ? { ...found } : null;
  }

  async findLatestByComplaintId(complaintId) {
    if (!complaintId) return null;
    const fileData = await this._readFile();
    const list = fileData.reminders || [];
    const target = String(complaintId).trim().toLowerCase();
    const matches = list.filter(
      (r) =>
        (r.complaintId && r.complaintId.toLowerCase() === target) ||
        (r.complaintReference && r.complaintReference.toLowerCase() === target)
    );
    if (matches.length === 0) return null;
    matches.sort((a, b) => new Date(b.requestedAt || b.createdAt) - new Date(a.requestedAt || a.createdAt));
    return { ...matches[0] };
  }

  async findAll(filters = {}) {
    const fileData = await this._readFile();
    let list = fileData.reminders || [];

    if (filters.complaintId) {
      const targetCmp = String(filters.complaintId).trim().toLowerCase();
      list = list.filter(
        (r) =>
          (r.complaintId && r.complaintId.toLowerCase() === targetCmp) ||
          (r.complaintReference && r.complaintReference.toLowerCase() === targetCmp)
      );
    }

    if (filters.citizenId) {
      list = list.filter((r) => r.citizenId === filters.citizenId);
    }

    if (filters.departmentId) {
      const targetDept = String(filters.departmentId).trim().toUpperCase();
      list = list.filter((r) => r.departmentId && r.departmentId.toUpperCase() === targetDept);
    }

    if (filters.status) {
      list = list.filter((r) => r.status === filters.status);
    }

    list.sort((a, b) => new Date(b.requestedAt || b.createdAt) - new Date(a.requestedAt || a.createdAt));
    return list.map((item) => ({ ...item }));
  }
}

export const jsonReminderRepository = new JsonReminderRepository();
