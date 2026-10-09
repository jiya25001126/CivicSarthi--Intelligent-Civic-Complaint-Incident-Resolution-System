import fs from 'fs/promises';
import config from '../config/app.config.js';

/**
 * File-backed Department Repository (JSON storage).
 */
export class JsonDepartmentRepository {
  constructor(customFilePath = null) {
    this.filePath = customFilePath || config.dataPath.departments;
  }

  setFilePath(customPath) {
    this.filePath = customPath;
  }

  resetFilePath() {
    this.filePath = config.dataPath.departments;
  }

  async _readFile() {
    const raw = await fs.readFile(this.filePath, 'utf-8');
    return JSON.parse(raw);
  }

  async findAll() {
    const data = await this._readFile();
    return data.departments || [];
  }

  async findById(id) {
    if (!id) return null;
    const data = await this._readFile();
    const dept = (data.departments || []).find(
      d => d.id === id || d.code === id || d.id?.toLowerCase() === id?.toLowerCase() || d.code?.toLowerCase() === id?.toLowerCase()
    );
    return dept || null;
  }

  async exists(id) {
    const dept = await this.findById(id);
    return Boolean(dept);
  }
}

export const jsonDepartmentRepository = new JsonDepartmentRepository();
export default jsonDepartmentRepository;
