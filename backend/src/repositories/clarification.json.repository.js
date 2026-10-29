import fs from 'fs/promises';
import config, { assertSafeWritePath } from '../config/app.config.js';
import { CLARIFICATION_STATUS } from '../constants/clarification.constants.js';

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

export class JsonClarificationRepository {
  constructor(customFilePath = null) {
    this._customFilePath = customFilePath;
    this._mutex = new AsyncMutex();
  }

  get filePath() {
    return this._customFilePath || config.dataPath.clarifications;
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
          metadata: { version: '1.0.0', description: 'CivicSarthi Citizen-Initiated Clarification Threads' },
          clarifications: []
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

  generateClarificationId(existingList = [], targetYear = null) {
    const year = targetYear || new Date().getFullYear();
    const prefix = `CLR-${year}-`;
    const seqs = existingList
      .filter((r) => r.id && r.id.startsWith(prefix))
      .map((r) => {
        const match = r.id.match(/^CLR-\d{4}-(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      });
    const nextSeq = seqs.length > 0 ? Math.max(...seqs) + 1 : 1;
    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  async create(data) {
    return this._mutex.run(async () => {
      const fileData = await this._readFile();
      const list = fileData.clarifications || [];

      const id = data.id || this.generateClarificationId(list);
      const now = new Date().toISOString();

      const newRecord = {
        ...data,
        id,
        status: data.status || CLARIFICATION_STATUS.OPEN,
        responses: data.responses || [],
        createdAt: data.createdAt || now,
        updatedAt: now
      };

      list.push(newRecord);
      fileData.clarifications = list;
      await this._writeFile(fileData);
      return { ...newRecord };
    });
  }

  async findById(id) {
    if (!id) return null;
    const fileData = await this._readFile();
    const list = fileData.clarifications || [];
    const target = String(id).trim().toLowerCase();
    const found = list.find((r) => r.id && r.id.toLowerCase() === target);
    return found ? { ...found } : null;
  }

  async findAll(filters = {}) {
    const fileData = await this._readFile();
    let list = fileData.clarifications || [];

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

    if (filters.requestType) {
      list = list.filter((r) => r.requestType === filters.requestType);
    }

    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return list.map((item) => ({ ...item }));
  }

  async update(id, updates) {
    return this._mutex.run(async () => {
      const fileData = await this._readFile();
      const list = fileData.clarifications || [];
      const idx = list.findIndex((r) => r.id === id);
      if (idx === -1) return null;

      const updated = {
        ...list[idx],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      list[idx] = updated;
      fileData.clarifications = list;
      await this._writeFile(fileData);
      return { ...updated };
    });
  }

  async addResponse(id, { response, responderId, responderName, responderRole }) {
    return this._mutex.run(async () => {
      const fileData = await this._readFile();
      const list = fileData.clarifications || [];
      const idx = list.findIndex((r) => r.id === id);
      if (idx === -1) return null;

      const current = list[idx];
      const now = new Date().toISOString();

      const responseEntry = {
        response: String(response).trim(),
        responderId: responderId || 'OFFICER',
        responderName: responderName || 'Department Officer',
        responderRole: responderRole || 'officer',
        respondedAt: now
      };

      const updated = {
        ...current,
        status: CLARIFICATION_STATUS.RESPONDED,
        responses: [...(current.responses || []), responseEntry],
        updatedAt: now
      };

      list[idx] = updated;
      fileData.clarifications = list;
      await this._writeFile(fileData);
      return { ...updated };
    });
  }

  async closeRequest(id, { closedBy, closedRole, reason }) {
    return this._mutex.run(async () => {
      const fileData = await this._readFile();
      const list = fileData.clarifications || [];
      const idx = list.findIndex((r) => r.id === id);
      if (idx === -1) return null;

      const current = list[idx];
      const now = new Date().toISOString();

      const updated = {
        ...current,
        status: CLARIFICATION_STATUS.CLOSED,
        closedAt: now,
        closedBy: closedBy || 'CITIZEN',
        closedReason: reason || 'Closed by user',
        updatedAt: now
      };

      list[idx] = updated;
      fileData.clarifications = list;
      await this._writeFile(fileData);
      return { ...updated };
    });
  }
}

export const jsonClarificationRepository = new JsonClarificationRepository();
