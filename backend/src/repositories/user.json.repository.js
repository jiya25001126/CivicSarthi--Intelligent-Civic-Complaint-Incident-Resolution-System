import fs from 'fs/promises';
import path from 'path';
import config from '../config/app.config.js';

class AsyncMutex {
  constructor() {
    this._queue = Promise.resolve();
  }

  run(fn) {
    let result;
    this._queue = this._queue.then(async () => {
      result = await fn();
    }).catch(err => {
      // Keep chain intact on error
      result = Promise.reject(err);
    });
    return this._queue.then(() => result);
  }
}

export class JsonUserRepository {
  constructor(customFilePath = null) {
    this.filePath = customFilePath || config.dataPath.users;
    this._mutex = new AsyncMutex();
  }

  setFilePath(customPath) {
    this.filePath = customPath;
  }

  resetFilePath() {
    this.filePath = config.dataPath.users;
  }

  async _ensureFile() {
    try {
      await fs.access(this.filePath);
    } catch {
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });
      const initialData = {
        metadata: {
          version: '1.0.0',
          description: 'CivicSarthi User Directory'
        },
        users: []
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
      return { metadata: {}, users: [] };
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

  async findById(id) {
    if (!id) return null;
    const data = await this._readFile();
    const user = (data.users || []).find(u => u.id === id);
    return user ? { ...user } : null;
  }

  async findByEmail(email) {
    if (!email) return null;
    const data = await this._readFile();
    const normalized = email.trim().toLowerCase();
    const user = (data.users || []).find(u => u.email?.toLowerCase() === normalized);
    return user ? { ...user } : null;
  }

  async findAll(filters = {}) {
    const data = await this._readFile();
    let users = data.users || [];

    if (filters.role && filters.role !== 'ALL') {
      users = users.filter(u => u.role === filters.role);
    }
    if (filters.departmentId && filters.departmentId !== 'ALL') {
      users = users.filter(u => u.departmentId === filters.departmentId);
    }
    if (typeof filters.isActive === 'boolean') {
      users = users.filter(u => u.isActive === filters.isActive);
    }

    return users.map(u => ({ ...u }));
  }

  async create(userData) {
    return this._mutex.run(async () => {
      const data = await this._readFile();
      data.users = data.users || [];

      const normalizedEmail = userData.email.trim().toLowerCase();
      const existing = data.users.find(u => u.email?.toLowerCase() === normalizedEmail);
      if (existing) {
        const err = new Error(`User with email '${normalizedEmail}' already exists`);
        err.status = 409;
        throw err;
      }

      const id = userData.id || `USR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const now = new Date().toISOString();

      const newUser = {
        id,
        email: normalizedEmail,
        passwordHash: userData.passwordHash,
        name: userData.name.trim(),
        role: userData.role || 'citizen',
        departmentId: userData.departmentId || null,
        isActive: userData.isActive !== undefined ? userData.isActive : true,
        createdAt: now,
        updatedAt: now
      };

      data.users.push(newUser);
      await this._writeFile(data);

      return { ...newUser };
    });
  }

  async update(id, updates) {
    return this._mutex.run(async () => {
      const data = await this._readFile();
      data.users = data.users || [];

      const index = data.users.findIndex(u => u.id === id);
      if (index === -1) {
        return null;
      }

      const current = data.users[index];
      const now = new Date().toISOString();

      // Email uniqueness if updating email
      if (updates.email) {
        const newEmail = updates.email.trim().toLowerCase();
        const conflict = data.users.find(u => u.id !== id && u.email?.toLowerCase() === newEmail);
        if (conflict) {
          const err = new Error(`User with email '${newEmail}' already exists`);
          err.status = 409;
          throw err;
        }
        current.email = newEmail;
      }

      if (updates.passwordHash !== undefined) current.passwordHash = updates.passwordHash;
      if (updates.name !== undefined) current.name = updates.name.trim();
      if (updates.role !== undefined) current.role = updates.role;
      if (updates.departmentId !== undefined) current.departmentId = updates.departmentId;
      if (updates.isActive !== undefined) current.isActive = updates.isActive;
      current.updatedAt = now;

      data.users[index] = current;
      await this._writeFile(data);

      return { ...current };
    });
  }

  async count() {
    const data = await this._readFile();
    return (data.users || []).length;
  }
}

export const jsonUserRepository = new JsonUserRepository();
export default jsonUserRepository;
