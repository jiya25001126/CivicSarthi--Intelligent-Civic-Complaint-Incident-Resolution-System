import AppealModel from '../models/appeal.model.js';
import { APPEAL_STATUS, validateAppealStatusTransition } from '../constants/feedback.constants.js';

export class MongoAppealRepository {
  async create(data) {
    const doc = new AppealModel(data);
    const saved = await doc.save();
    return saved.toObject();
  }

  async findById(idOrRef) {
    const doc = await AppealModel.findOne({
      $or: [{ id: idOrRef }, { referenceNumber: idOrRef }]
    }).lean();
    return doc;
  }

  async findAll(filters = {}) {
    const query = {};
    if (filters.complaintId) {
      query.$or = [{ complaintId: filters.complaintId }, { complaintReference: filters.complaintId }];
    }
    if (filters.requesterId) {
      query.requesterId = filters.requesterId;
    }
    if (filters.departmentId) {
      query.departmentId = filters.departmentId;
    }
    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.assignedReviewerId) {
      query.assignedReviewerId = filters.assignedReviewerId;
    }

    const docs = await AppealModel.find(query).sort({ createdAt: -1 }).lean();
    return docs;
  }

  async update(id, updates) {
    const doc = await AppealModel.findOneAndUpdate(
      { $or: [{ id }, { referenceNumber: id }] },
      { ...updates, updatedAt: new Date() },
      { new: true }
    ).lean();
    return doc;
  }

  async updateStatus(id, { status, remarks, actorId, actorRole }) {
    const current = await this.findById(id);
    if (!current) return null;

    const { valid, allowed } = validateAppealStatusTransition(current.status, status);
    if (!valid) {
      const err = new Error(
        `Invalid appeal status transition from '${current.status}' to '${status}'. Allowed: ${allowed.join(', ')}`
      );
      err.status = 400;
      err.code = 'INVALID_APPEAL_TRANSITION';
      throw err;
    }

    const now = new Date();
    const historyEntry = {
      status,
      timestamp: now,
      actorId: actorId || 'SYSTEM',
      actorRole: actorRole || 'officer',
      remarks: remarks || `Appeal status updated to ${status}`
    };

    const doc = await AppealModel.findOneAndUpdate(
      { $or: [{ id }, { referenceNumber: id }] },
      {
        $set: { status, updatedAt: now },
        $push: { statusHistory: historyEntry }
      },
      { new: true }
    ).lean();
    return doc;
  }

  async addInternalNote(id, { note, officerId }) {
    const noteEntry = {
      note,
      officerId: officerId || 'OFFICER',
      createdAt: new Date()
    };

    const doc = await AppealModel.findOneAndUpdate(
      { $or: [{ id }, { referenceNumber: id }] },
      {
        $push: { internalNotes: noteEntry },
        $set: { updatedAt: new Date() }
      },
      { new: true }
    ).lean();
    return doc;
  }

  async recordDecision(id, { outcome, reason, reviewerId, actorRole }) {
    const current = await this.findById(id);
    if (!current) return null;

    const targetStatus = outcome === 'UPHELD' ? APPEAL_STATUS.UPHELD : APPEAL_STATUS.REJECTED;
    const { valid, allowed } = validateAppealStatusTransition(current.status, targetStatus);
    if (!valid) {
      const err = new Error(
        `Invalid appeal status transition from '${current.status}' to '${targetStatus}'. Allowed: ${allowed.join(', ')}`
      );
      err.status = 400;
      err.code = 'INVALID_APPEAL_TRANSITION';
      throw err;
    }

    const now = new Date();
    const decisionObj = {
      outcome,
      reason,
      reviewerId: reviewerId || 'OFFICER',
      decidedAt: now
    };

    const historyEntry = {
      status: targetStatus,
      timestamp: now,
      actorId: reviewerId || 'OFFICER',
      actorRole: actorRole || 'officer',
      remarks: `Appeal ${outcome}: ${reason}`
    };

    const doc = await AppealModel.findOneAndUpdate(
      { $or: [{ id }, { referenceNumber: id }] },
      {
        $set: { status: targetStatus, decision: decisionObj, updatedAt: now },
        $push: { statusHistory: historyEntry }
      },
      { new: true }
    ).lean();
    return doc;
  }
}

export const mongoAppealRepository = new MongoAppealRepository();
