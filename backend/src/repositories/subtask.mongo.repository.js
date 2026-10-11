import { SubtaskModel } from '../models/subtask.model.js';
import {
  SUBTASK_STATUS,
  validateSubtaskStatusTransition
} from '../constants/incident.constants.js';

/**
 * MongoDB Mongoose-backed Subtask Repository.
 */
export class MongoSubtaskRepository {
  _formatSubtask(doc) {
    if (!doc) return null;
    const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    const { _id, __v, ...rest } = obj;
    return rest;
  }

  async findAll(filters = {}) {
    const query = {};

    if (filters.incidentId) {
      query.incidentId = filters.incidentId;
    }

    if (filters.complaintId) {
      query.complaintId = filters.complaintId;
    }

    if (filters.department && filters.department !== 'ALL') {
      query.department = filters.department;
    }

    if (filters.status && filters.status !== 'ALL') {
      query.status = filters.status;
    }

    if (filters.assignedOfficerId || filters.officerId) {
      const targetOfficer = filters.assignedOfficerId || filters.officerId;
      query.$or = [
        { assignedOfficerId: targetOfficer },
        { officerId: targetOfficer }
      ];
    }

    if (filters.search && filters.search.trim() !== '') {
      const q = filters.search.trim();
      const regex = new RegExp(q, 'i');
      query.$or = [
        { id: regex },
        { title: regex },
        { remarks: regex }
      ];
    }

    const sortOptions = { createdAt: 1 };
    const rawList = await SubtaskModel.find(query).sort(sortOptions).lean();
    return rawList.map(this._formatSubtask);
  }

  async findById(id) {
    if (!id) return null;
    const target = String(id).trim();
    const regex = new RegExp(`^${target}$`, 'i');
    const doc = await SubtaskModel.findOne({ id: regex }).lean();
    return this._formatSubtask(doc);
  }

  /**
   * Generates unique sequence ID for subtasks in MongoDB: SUB-YYYY-XXX
   * Accepts extraExcludedIds to guarantee distinct candidate IDs across retry attempts.
   */
  async generateSubtaskId(targetYear = new Date().getFullYear(), existingSubtasks = null, extraExcludedIds = new Set()) {
    const yearStr = String(targetYear);
    let matching = existingSubtasks;

    if (!matching) {
      const regex = new RegExp(`^SUB-${yearStr}-(\\d+)`, 'i');
      matching = await SubtaskModel.find({ id: regex }, { id: 1 }).lean();
    }

    const excludedList = Array.from(extraExcludedIds || []).map(id => String(id).toUpperCase());
    const existingIds = new Set([
      ...(matching || []).map(s => (s.id || '').toUpperCase()),
      ...excludedList
    ]);

    let maxNum = 0;
    for (const sub of matching || []) {
      const match = (sub.id || '').match(/SUB-(\d{4})-(\d+)/i);
      if (match && match[1] === yearStr) {
        const num = parseInt(match[2], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }

    for (const exId of excludedList) {
      const match = exId.match(/SUB-(\d{4})-(\d+)/i);
      if (match && match[1] === yearStr) {
        const num = parseInt(match[2], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }

    let candidateSeq = maxNum + 1;
    let candidateId = `SUB-${yearStr}-${String(candidateSeq).padStart(3, '0')}`;
    while (existingIds.has(candidateId.toUpperCase())) {
      candidateSeq++;
      candidateId = `SUB-${yearStr}-${String(candidateSeq).padStart(3, '0')}`;
    }

    return candidateId;
  }

  async create(subtaskData) {
    const officer = subtaskData.assignedOfficerId || subtaskData.officerId || null;
    const maxRetries = 5;
    let attempt = 0;
    const attemptedIds = new Set();

    while (attempt < maxRetries) {
      attempt++;
      const id = subtaskData.id || (await this.generateSubtaskId(undefined, null, attemptedIds));
      attemptedIds.add(id);

      const doc = new SubtaskModel({
        ...subtaskData,
        id,
        assignedOfficerId: officer,
        officerId: officer
      });

      try {
        await doc.save();
        return this._formatSubtask(doc.toObject());
      } catch (err) {
        if (subtaskData.id || err.code !== 11000 || attempt >= maxRetries) {
          throw err;
        }
      }
    }

    throw new Error('Failed to generate unique subtask ID after multiple retries.');
  }

  async update(id, updateData) {
    const target = String(id).trim();
    const regex = new RegExp(`^${target}$`, 'i');

    const doc = await SubtaskModel.findOne({ id: regex });
    if (!doc) return null;

    if (updateData.status && updateData.status !== doc.status) {
      const transition = validateSubtaskStatusTransition(doc.status, updateData.status);
      if (!transition.valid) {
        const err = new Error(
          `Invalid subtask status transition from '${doc.status}' to '${updateData.status}'. Allowed: ${transition.allowed.join(', ') || 'None'}`
        );
        err.status = 400;
        throw err;
      }
    }

    const officer = updateData.assignedOfficerId !== undefined
      ? updateData.assignedOfficerId
      : (updateData.officerId !== undefined ? updateData.officerId : doc.assignedOfficerId);

    Object.assign(doc, {
      ...updateData,
      assignedOfficerId: officer,
      officerId: officer
    });

    const timestamp = new Date();
    doc.updatedAt = timestamp;

    if (updateData.status === SUBTASK_STATUS.COMPLETED && !doc.completedAt) {
      doc.completedAt = timestamp;
    }

    await doc.save();
    return this._formatSubtask(doc.toObject());
  }

  async delete(id) {
    const target = String(id).trim();
    const regex = new RegExp(`^${target}$`, 'i');
    const res = await SubtaskModel.deleteOne({ id: regex });
    return res.deletedCount > 0;
  }

  async count(filters = {}) {
    const query = {};
    if (filters.incidentId) {
      query.incidentId = filters.incidentId;
    }
    if (filters.status && filters.status !== 'ALL') {
      query.status = filters.status;
    }
    return SubtaskModel.countDocuments(query);
  }
}

export const mongoSubtaskRepository = new MongoSubtaskRepository();
export default mongoSubtaskRepository;
