import { IncidentModel } from '../models/incident.model.js';
import {
  INCIDENT_STATUS,
  validateIncidentStatusTransition
} from '../constants/incident.constants.js';

/**
 * MongoDB Mongoose-backed Incident Repository.
 */
export class MongoIncidentRepository {
  _formatIncident(doc) {
    if (!doc) return null;
    const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    const { _id, __v, ...rest } = obj;
    return rest;
  }

  async findAll(filters = {}) {
    const query = {};

    if (filters.status && filters.status !== 'ALL') {
      query.status = filters.status;
    }

    if (filters.category && filters.category !== 'ALL') {
      query.category = filters.category.toLowerCase();
    }

    if (filters.priority && filters.priority !== 'ALL') {
      query.priority = filters.priority;
    }

    if (filters.leadDepartment && filters.leadDepartment !== 'ALL') {
      query.leadDepartment = filters.leadDepartment;
    }

    if (filters.participatingDepartment && filters.participatingDepartment !== 'ALL') {
      query.participatingDepartments = filters.participatingDepartment;
    }

    if (filters.search && filters.search.trim() !== '') {
      const q = filters.search.trim();
      const regex = new RegExp(q, 'i');
      query.$or = [
        { id: regex },
        { title: regex },
        { description: regex },
        { category: regex },
        { leadDepartment: regex }
      ];
    }

    const sortOptions = { createdAt: -1 };

    if (filters.page && filters.limit) {
      const page = Math.max(1, parseInt(filters.page, 10));
      const limit = Math.max(1, parseInt(filters.limit, 10));
      const skip = (page - 1) * limit;

      const [total, rawItems] = await Promise.all([
        IncidentModel.countDocuments(query),
        IncidentModel.find(query).sort(sortOptions).skip(skip).limit(limit).lean()
      ]);

      const items = rawItems.map(this._formatIncident);
      const totalPages = Math.ceil(total / limit);

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

    const rawList = await IncidentModel.find(query).sort(sortOptions).lean();
    return rawList.map(this._formatIncident);
  }

  async findById(id) {
    if (!id) return null;
    const target = String(id).trim();
    const regex = new RegExp(`^${target}$`, 'i');
    const doc = await IncidentModel.findOne({ id: regex }).lean();
    return this._formatIncident(doc);
  }

  /**
   * Generates unique sequence ID for parent incidents in MongoDB: INC-YYYY-XXXX
   * Accepts extraExcludedIds to guarantee distinct candidate IDs across retry attempts.
   */
  async generateIncidentId(targetYear = new Date().getFullYear(), existingIncidents = null, extraExcludedIds = new Set()) {
    const yearStr = String(targetYear);
    let matching = existingIncidents;

    if (!matching) {
      const regex = new RegExp(`^INC-${yearStr}-(\\d+)`, 'i');
      matching = await IncidentModel.find({ id: regex }, { id: 1 }).lean();
    }

    const excludedList = Array.from(extraExcludedIds || []).map(id => String(id).toUpperCase());
    const existingIds = new Set([
      ...(matching || []).map(i => (i.id || '').toUpperCase()),
      ...excludedList
    ]);

    let maxNum = 0;
    for (const inc of matching || []) {
      const match = (inc.id || '').match(/INC-(\d{4})-(\d+)/i);
      if (match && match[1] === yearStr) {
        const num = parseInt(match[2], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }

    for (const exId of excludedList) {
      const match = exId.match(/INC-(\d{4})-(\d+)/i);
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

  async create(incidentData) {
    const participating = Array.from(new Set([
      incidentData.leadDepartment,
      ...(Array.isArray(incidentData.participatingDepartments) ? incidentData.participatingDepartments : [])
    ]));

    const maxRetries = 5;
    let attempt = 0;
    const attemptedIds = new Set();

    while (attempt < maxRetries) {
      attempt++;
      const id = incidentData.id || (await this.generateIncidentId(undefined, null, attemptedIds));
      attemptedIds.add(id);

      const doc = new IncidentModel({
        ...incidentData,
        id,
        participatingDepartments: participating,
        linkedComplaints: Array.isArray(incidentData.linkedComplaints) ? incidentData.linkedComplaints : []
      });

      try {
        await doc.save();
        return this._formatIncident(doc.toObject());
      } catch (err) {
        if (incidentData.id || err.code !== 11000 || attempt >= maxRetries) {
          throw err;
        }
      }
    }

    throw new Error('Failed to generate unique incident ID after multiple retries.');
  }

  async update(id, updateData) {
    const target = String(id).trim();
    const regex = new RegExp(`^${target}$`, 'i');

    const doc = await IncidentModel.findOne({ id: regex });
    if (!doc) return null;

    if (updateData.status && updateData.status !== doc.status) {
      const transition = validateIncidentStatusTransition(doc.status, updateData.status);
      if (!transition.valid) {
        const err = new Error(
          `Invalid incident status transition from '${doc.status}' to '${updateData.status}'. Allowed: ${transition.allowed.join(', ') || 'None'}`
        );
        err.status = 400;
        throw err;
      }
    }

    Object.assign(doc, updateData);

    const timestamp = new Date();
    doc.updatedAt = timestamp;

    if (updateData.status === INCIDENT_STATUS.RESOLVED && !doc.resolvedAt) {
      doc.resolvedAt = timestamp;
    }
    if (updateData.status === INCIDENT_STATUS.CLOSED && !doc.closedAt) {
      doc.closedAt = timestamp;
    }

    if (doc.leadDepartment) {
      const set = new Set([doc.leadDepartment, ...(doc.participatingDepartments || [])]);
      doc.participatingDepartments = Array.from(set);
    }

    await doc.save();
    return this._formatIncident(doc.toObject());
  }

  async linkComplaint(incidentId, complaintId) {
    const target = String(incidentId).trim();
    const regex = new RegExp(`^${target}$`, 'i');

    const doc = await IncidentModel.findOne({ id: regex });
    if (!doc) return null;

    const cIdStr = String(complaintId).trim();
    if (!doc.linkedComplaints.includes(cIdStr)) {
      doc.linkedComplaints.push(cIdStr);
      doc.updatedAt = new Date();
      await doc.save();
    }

    return this._formatIncident(doc.toObject());
  }

  async unlinkComplaint(incidentId, complaintId) {
    const target = String(incidentId).trim();
    const regex = new RegExp(`^${target}$`, 'i');

    const doc = await IncidentModel.findOne({ id: regex });
    if (!doc) return null;

    const cIdStr = String(complaintId).trim().toLowerCase();
    doc.linkedComplaints = doc.linkedComplaints.filter(c => c.toLowerCase() !== cIdStr);
    doc.updatedAt = new Date();
    await doc.save();

    return this._formatIncident(doc.toObject());
  }

  async count(filters = {}) {
    const query = {};
    if (filters.status && filters.status !== 'ALL') {
      query.status = filters.status;
    }
    return IncidentModel.countDocuments(query);
  }
}

export const mongoIncidentRepository = new MongoIncidentRepository();
export default mongoIncidentRepository;
