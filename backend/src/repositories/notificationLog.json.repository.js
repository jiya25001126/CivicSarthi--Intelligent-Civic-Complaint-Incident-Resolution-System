import fs from 'fs/promises';
import config, { assertSafeWritePath } from '../config/app.config.js';
import { NOTIFICATION_STATUS } from '../constants/notification.constants.js';

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

export class JsonNotificationLogRepository {
  constructor(customFilePath = null) {
    this._customFilePath = customFilePath;
    this._mutex = new AsyncMutex();
  }

  get filePath() {
    return this._customFilePath || config.dataPath.notifications;
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
          metadata: { version: '1.0.0', description: 'CivicSarthi Notification Delivery Audit Trail' },
          notifications: []
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
    try {
      while (attempts < 5) {
        try {
          await fs.rename(tempPath, this.filePath);
          return;
        } catch {
          attempts++;
          if (attempts >= 5) {
            await fs.copyFile(tempPath, this.filePath);
            return;
          }
          await new Promise((res) => setTimeout(res, 20 * attempts));
        }
      }
    } finally {
      await fs.unlink(tempPath).catch(() => {});
    }
  }

  async create(data) {
    return this._mutex.run(async () => {
      const db = await this._readFile();
      const id = data.id || `NOTIF-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      const newLog = {
        id,
        recipientPhone: data.recipientPhone,
        channel: data.channel,
        eventType: data.eventType,
        complaintId: data.complaintId || null,
        complaintReference: data.complaintReference || null,
        citizenId: data.citizenId || null,
        status: data.status || NOTIFICATION_STATUS.SENT,
        provider: data.provider || 'mock',
        providerMessageId: data.providerMessageId || null,
        messageBody: data.messageBody || null,
        templateName: data.templateName || null,
        idempotencyKey: data.idempotencyKey || null,
        attempts: data.attempts || 1,
        error: data.error || null,
        sentAt: data.sentAt || new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      db.notifications = db.notifications || [];
      db.notifications.push(newLog);
      await this._writeFile(db);
      return newLog;
    });
  }

  async findByProviderMessageId(providerMessageId) {
    if (!providerMessageId) return null;
    const db = await this._readFile();
    return (db.notifications || []).find((n) => n.providerMessageId === providerMessageId) || null;
  }

  async findById(id) {
    const db = await this._readFile();
    return (db.notifications || []).find((n) => n.id === id) || null;
  }

  async findLatestByIdempotencyKey(key) {
    if (!key) return null;
    const db = await this._readFile();
    const matching = (db.notifications || []).filter((n) => n.idempotencyKey === key);
    if (matching.length === 0) return null;
    matching.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return matching[0];
  }

  async findAll(filters = {}) {
    const db = await this._readFile();
    let items = db.notifications || [];

    if (filters.complaintId) {
      items = items.filter((n) => n.complaintId === filters.complaintId);
    }
    if (filters.citizenId) {
      items = items.filter((n) => n.citizenId === filters.citizenId);
    }
    if (filters.channel) {
      items = items.filter((n) => n.channel === filters.channel);
    }
    if (filters.eventType) {
      items = items.filter((n) => n.eventType === filters.eventType);
    }
    if (filters.status) {
      items = items.filter((n) => n.status === filters.status);
    }

    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return items;
  }

  async update(id, updates) {
    return this._mutex.run(async () => {
      const db = await this._readFile();
      const index = (db.notifications || []).findIndex((n) => n.id === id);
      if (index === -1) return null;

      db.notifications[index] = {
        ...db.notifications[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await this._writeFile(db);
      return db.notifications[index];
    });
  }
}

export const jsonNotificationLogRepository = new JsonNotificationLogRepository();
export default jsonNotificationLogRepository;

