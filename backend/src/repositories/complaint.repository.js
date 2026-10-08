import fs from 'fs/promises';
import config from '../config/app.config.js';

/**
 * File-backed Complaint Repository.
 * Abstracted so that MongoDB / Mongoose can easily replace this implementation
 * in a subsequent phase without changing services or controllers.
 */
class ComplaintRepository {
  constructor() {
    this.filePath = config.dataPath.complaints;
  }

  async _readFile() {
    const raw = await fs.readFile(this.filePath, 'utf-8');
    return JSON.parse(raw);
  }

  async _writeFile(data) {
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  async findAll(filters = {}) {
    const data = await this._readFile();
    let list = data.complaints || [];

    if (filters.category) {
      list = list.filter(c => c.category?.toLowerCase() === filters.category.toLowerCase());
    }
    if (filters.department) {
      list = list.filter(c => c.department === filters.department);
    }
    if (filters.status) {
      list = list.filter(c => c.status === filters.status);
    }
    if (filters.priority) {
      list = list.filter(c => c.priority === filters.priority);
    }

    return list;
  }

  async findById(id) {
    const data = await this._readFile();
    const complaint = (data.complaints || []).find(c => c.id === id);
    return complaint || null;
  }

  async create(complaintData) {
    const data = await this._readFile();
    const newComplaint = {
      ...complaintData,
      createdAt: complaintData.createdAt || new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      synthetic: true
    };
    data.complaints = data.complaints || [];
    data.complaints.push(newComplaint);
    data.metadata.total = data.complaints.length;
    await this._writeFile(data);
    return newComplaint;
  }

  async update(id, updateData) {
    const data = await this._readFile();
    const index = (data.complaints || []).findIndex(c => c.id === id);
    if (index === -1) return null;

    data.complaints[index] = {
      ...data.complaints[index],
      ...updateData,
      lastUpdated: new Date().toISOString()
    };
    await this._writeFile(data);
    return data.complaints[index];
  }
}

export const complaintRepository = new ComplaintRepository();
export default complaintRepository;
