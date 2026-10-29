import fs from 'fs/promises';
import path from 'path';
import config, { assertSafeWritePath } from '../config/app.config.js';
import { isConnected, getConfiguredPersistenceMode } from '../config/database.js';
import { AuditLogModel } from '../models/auditLog.model.js';

class AsyncMutex {
  constructor() {
    this._queue = Promise.resolve();
  }

  run(fn) {
    let result;
    this._queue = this._queue.then(async () => {
      result = await fn();
    }).catch(err => {
      result = Promise.reject(err);
    });
    return this._queue.then(() => result);
  }
}

export class JsonAuditLogRepository {
  constructor(customFilePath = null) {
    this._customFilePath = customFilePath;
    this._mutex = new AsyncMutex();
  }

  get filePath() {
    return this._customFilePath || config.dataPath.auditLogs;
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

  async _ensureFile() {
    assertSafeWritePath(this.filePath);
    try {
      await fs.access(this.filePath);
    } catch {
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });
      const initialData = {
        metadata: {
          version: '1.0.0',
          description: 'CivicSarthi Security Audit Logs'
        },
        logs: []
      };
      await fs.writeFile(this.filePath, JSON.stringify(initialData, null, 2), 'utf-8');
    }
  }

  async _readFile() {
    await this._ensureFile();
    const raw = await fs.readFile(this.filePath, 'utf-8');
    try {
      return JSON.parse(raw);
    } catch {
      return { metadata: {}, logs: [] };
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

  async create(logData) {
    return this._mutex.run(async () => {
      const data = await this._readFile();
      data.logs = data.logs || [];

      const newLog = {
        id: `AUDIT-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        timestamp: new Date().toISOString(),
        userId: logData.userId || 'SYSTEM',
        userEmail: logData.userEmail || 'system@internal',
        role: logData.role || 'system',
        action: logData.action,
        targetResource: logData.targetResource || null,
        complaintId: logData.complaintId || logData.targetResource || null,
        details: logData.details || {},
        ipAddress: logData.ipAddress || '127.0.0.1'
      };

      data.logs.unshift(newLog);
      await this._writeFile(data);
      return { ...newLog };
    });
  }

  async findAll(filters = {}) {
    const data = await this._readFile();
    let logs = data.logs || [];

    if (filters.action) {
      logs = logs.filter(l => l.action === filters.action);
    }
    if (filters.userId) {
      logs = logs.filter(l => l.userId === filters.userId);
    }

    if (filters.limit) {
      const limit = parseInt(filters.limit, 10);
      logs = logs.slice(0, limit);
    }

    return logs.map(l => ({ ...l }));
  }

  async queryLogs(filters = {}) {
    return this.findAll(filters);
  }
}

export class MongoAuditLogRepository {
  async create(logData) {
    const newLog = {
      id: `AUDIT-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      timestamp: new Date(),
      userId: logData.userId || 'SYSTEM',
      userEmail: logData.userEmail || 'system@internal',
      role: logData.role || 'system',
      action: logData.action,
      targetResource: logData.targetResource || null,
      complaintId: logData.complaintId || logData.targetResource || null,
      details: logData.details || {},
      ipAddress: logData.ipAddress || '127.0.0.1'
    };
    const doc = await AuditLogModel.create(newLog);
    return doc.toObject();
  }

  async findAll(filters = {}) {
    const query = {};
    if (filters.action) query.action = filters.action;
    if (filters.userId) query.userId = filters.userId;

    let cursor = AuditLogModel.find(query).sort({ timestamp: -1 });
    if (filters.limit) {
      cursor = cursor.limit(parseInt(filters.limit, 10));
    }
    return cursor.lean();
  }

  async queryLogs(filters = {}) {
    return this.findAll(filters);
  }
}

export class AuditLogRepository {
  constructor(customFilePath = null) {
    this._jsonRepo = new JsonAuditLogRepository(customFilePath);
    this._mongoRepo = new MongoAuditLogRepository();
  }

  setFilePath(customPath) {
    this._jsonRepo.setFilePath(customPath);
  }

  resetFilePath() {
    this._jsonRepo.resetFilePath();
  }

  get filePath() {
    return this._jsonRepo.filePath;
  }

  _getActiveAdapter() {
    const configuredMode = getConfiguredPersistenceMode();
    if (configuredMode === 'mongodb') {
      if (!isConnected()) {
        const err = new Error('Persistence Error: MongoDB not connected.');
        err.status = 503;
        throw err;
      }
      return this._mongoRepo;
    }
    if (configuredMode === 'auto') {
      return isConnected() ? this._mongoRepo : this._jsonRepo;
    }
    return this._jsonRepo;
  }

  async create(logData) {
    return this._getActiveAdapter().create(logData);
  }

  async findAll(filters = {}) {
    return this._getActiveAdapter().findAll(filters);
  }

  async queryLogs(filters = {}) {
    return this._getActiveAdapter().findAll(filters);
  }
}

export const auditLogRepository = new AuditLogRepository();
export default auditLogRepository;
