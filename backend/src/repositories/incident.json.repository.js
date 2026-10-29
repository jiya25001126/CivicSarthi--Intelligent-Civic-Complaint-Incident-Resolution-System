import fs from 'fs/promises';
import config, { assertSafeWritePath } from '../config/app.config.js';
import {
  INCIDENT_STATUS,
  INCIDENT_PRIORITY,
  validateIncidentStatusTransition
} from '../constants/incident.constants.js';

/**
 * Lightweight in-process promise-chain mutex for serializing concurrent file writes.
 */
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

/**
 * File-backed Incident Repository (JSON storage).
 * Serializes mutations via AsyncMutex and uses atomic temporary-file renames with retry.
 */
export class JsonIncidentRepository {
  constructor(customFilePath = null) {
    this._customFilePath = customFilePath;
    this._mutex = new AsyncMutex();
  }

  get filePath() {
    return this._customFilePath || config.dataPath.incidents;
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
    const raw = await fs.readFile(this.filePath, 'utf-8');
    return JSON.parse(raw);
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

  /**
   * Generates unique sequence ID for parent incidents: INC-YYYY-XXXX
   */
  generateIncidentId(incidents = [], targetYear = new Date().getFullYear()) {
    const yearStr = String(targetYear);
    const existingIds = new Set((incidents || []).map(i => (i.id || '').toUpperCase()));

    let maxNum = 0;
    for (const inc of incidents || []) {
      const match = (inc.id || '').match(/INC-(\d{4})-(\d+)/i);
      if (match && match[1] === yearStr) {
        const num = parseInt(match[2], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }

    let candidateSeq = maxNum + 1;
    let candidateId = `INC-${yearStr}-${String(candidateSeq).padStart(4, '0')}`;
    while (existingIds.has(candidateId.toUpperCase())) {
      candidateSeq++;
      candidateId = `INC-${yearStr}-${String(candidateSeq).padStart(4, '0')}`;
    }

    return candidateId;
  }

  /**
   * Find incidents with filtering, search, and pagination
   */
  async findAll(filters = {}) {
    const data = await this._readFile();
    let list = data.incidents || [];

    // Filter by status
    if (filters.status && filters.status !== 'ALL') {
      list = list.filter(i => i.status === filters.status);
    }

    // Filter by category
    if (filters.category && filters.category !== 'ALL') {
      list = list.filter(i => i.category?.toLowerCase() === filters.category.toLowerCase());
    }

    // Filter by priority
    if (filters.priority && filters.priority !== 'ALL') {
      list = list.filter(i => i.priority === filters.priority);
    }

    // Filter by leadDepartment
    if (filters.leadDepartment && filters.leadDepartment !== 'ALL') {
      list = list.filter(i => i.leadDepartment === filters.leadDepartment);
    }

    // Filter by participatingDepartment
    if (filters.participatingDepartment && filters.participatingDepartment !== 'ALL') {
      list = list.filter(i =>
        Array.isArray(i.participatingDepartments) &&
        i.participatingDepartments.includes(filters.participatingDepartment)
      );
    }

    // Free text search
    if (filters.search && filters.search.trim() !== '') {
      const q = filters.search.trim().toLowerCase();
      list = list.filter(i =>
        i.id?.toLowerCase().includes(q) ||
        i.title?.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q) ||
        i.category?.toLowerCase().includes(q) ||
        i.leadDepartment?.toLowerCase().includes(q)
      );
    }

    // Sort by createdAt desc by default
    list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    // Optional Pagination
    if (filters.page && filters.limit) {
      const page = Math.max(1, parseInt(filters.page, 10));
      const limit = Math.max(1, parseInt(filters.limit, 10));
      const total = list.length;
      const totalPages = Math.ceil(total / limit);
      const skip = (page - 1) * limit;
      const items = list.slice(skip, skip + limit);

      return {
        items,
        pagination: {
          total,
          page,
          limit,
          totalPages
        }
      };
    }

    return list;
  }

  /**
   * Find incident by ID (case-insensitive)
   */
  async findById(id) {
    if (!id) return null;
    const target = String(id).trim().toLowerCase();
    const data = await this._readFile();
    const incident = (data.incidents || []).find(i => i.id?.toLowerCase() === target);
    return incident || null;
  }

  /**
   * Create new parent incident
   */
  async create(incidentData) {
    if (!incidentData.title || !incidentData.category || !incidentData.leadDepartment) {
      const err = new Error('Incident requires title, category, and leadDepartment');
      err.status = 400;
      throw err;
    }

    return this._mutex.run(async () => {
      const data = await this._readFile();
      if (!Array.isArray(data.incidents)) {
        data.incidents = [];
      }

      const id = incidentData.id || this.generateIncidentId(data.incidents);
      const timestamp = new Date().toISOString();

      const participating = Array.from(new Set([
        incidentData.leadDepartment,
        ...(Array.isArray(incidentData.participatingDepartments) ? incidentData.participatingDepartments : [])
      ]));

      const newIncident = {
        id,
        referenceNumber: id,
        title: incidentData.title.trim(),
        description: (incidentData.description || '').trim(),
        category: incidentData.category.trim().toLowerCase(),
        priority: incidentData.priority || INCIDENT_PRIORITY.MEDIUM,
        status: incidentData.status || INCIDENT_STATUS.ACTIVE,
        leadDepartment: incidentData.leadDepartment,
        participatingDepartments: participating,
        linkedComplaints: Array.isArray(incidentData.linkedComplaints) ? [...incidentData.linkedComplaints] : [],
        location: incidentData.location || { locality: '', district: 'Pune', state: 'Maharashtra' },
        createdBy: incidentData.createdBy || 'SYSTEM',
        resolutionSummary: incidentData.resolutionSummary || null,
        resolvedAt: incidentData.resolvedAt || null,
        closedAt: incidentData.closedAt || null,
        synthetic: Boolean(incidentData.synthetic),
        createdAt: incidentData.createdAt || timestamp,
        updatedAt: incidentData.updatedAt || timestamp
      };

      data.incidents.push(newIncident);
      await this._writeFile(data);
      return newIncident;
    });
  }

  /**
   * Update existing incident by ID with transition validation
   */
  async update(id, updateData) {
    return this._mutex.run(async () => {
      const data = await this._readFile();
      const target = String(id).trim().toLowerCase();
      const index = (data.incidents || []).findIndex(i => i.id?.toLowerCase() === target);

      if (index === -1) return null;

      const current = data.incidents[index];

      // Validate status transition if status is being updated
      if (updateData.status && updateData.status !== current.status) {
        const transition = validateIncidentStatusTransition(current.status, updateData.status);
        if (!transition.valid) {
          const err = new Error(
            `Invalid incident status transition from '${current.status}' to '${updateData.status}'. Allowed: ${transition.allowed.join(', ') || 'None'}`
          );
          err.status = 400;
          throw err;
        }
      }

      const timestamp = new Date().toISOString();

      const updated = {
        ...current,
        ...updateData,
        id: current.id, // Immutable
        createdAt: current.createdAt, // Immutable
        updatedAt: timestamp
      };

      if (updateData.status === INCIDENT_STATUS.RESOLVED && !updated.resolvedAt) {
        updated.resolvedAt = timestamp;
      }
      if (updateData.status === INCIDENT_STATUS.CLOSED && !updated.closedAt) {
        updated.closedAt = timestamp;
      }

      // Ensure participatingDepartments includes leadDepartment
      if (updated.leadDepartment) {
        const set = new Set([updated.leadDepartment, ...(updated.participatingDepartments || [])]);
        updated.participatingDepartments = Array.from(set);
      }

      data.incidents[index] = updated;
      await this._writeFile(data);
      return updated;
    });
  }

  /**
   * Link complaint to incident
   */
  async linkComplaint(incidentId, complaintId) {
    return this._mutex.run(async () => {
      const data = await this._readFile();
      const target = String(incidentId).trim().toLowerCase();
      const index = (data.incidents || []).findIndex(i => i.id?.toLowerCase() === target);

      if (index === -1) return null;

      const incident = data.incidents[index];
      if (!Array.isArray(incident.linkedComplaints)) {
        incident.linkedComplaints = [];
      }

      const cIdStr = String(complaintId).trim();
      if (!incident.linkedComplaints.includes(cIdStr)) {
        incident.linkedComplaints.push(cIdStr);
        incident.updatedAt = new Date().toISOString();
        await this._writeFile(data);
      }

      return incident;
    });
  }

  /**
   * Unlink complaint from incident
   */
  async unlinkComplaint(incidentId, complaintId) {
    return this._mutex.run(async () => {
      const data = await this._readFile();
      const target = String(incidentId).trim().toLowerCase();
      const index = (data.incidents || []).findIndex(i => i.id?.toLowerCase() === target);

      if (index === -1) return null;

      const incident = data.incidents[index];
      const cIdStr = String(complaintId).trim().toLowerCase();

      if (Array.isArray(incident.linkedComplaints)) {
        incident.linkedComplaints = incident.linkedComplaints.filter(c => c.toLowerCase() !== cIdStr);
        incident.updatedAt = new Date().toISOString();
        await this._writeFile(data);
      }

      return incident;
    });
  }

  /**
   * Count incidents matching criteria
   */
  async count(filters = {}) {
    const all = await this.findAll(filters);
    return Array.isArray(all) ? all.length : all.pagination?.total || 0;
  }
}

export const jsonIncidentRepository = new JsonIncidentRepository();
export default jsonIncidentRepository;
