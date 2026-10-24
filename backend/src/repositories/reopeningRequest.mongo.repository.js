import ReopeningRequestModel from '../models/reopeningRequest.model.js';
import {
  REOPENING_STATUS,
  validateReopeningStatusTransition
} from '../constants/feedback.constants.js';

export class MongoReopeningRequestRepository {
  async create(data) {
    const doc = new ReopeningRequestModel(data);
    const saved = await doc.save();
    return saved.toObject();
  }

  async findById(idOrRef) {
    const doc = await ReopeningRequestModel.findOne({
      $or: [{ id: idOrRef }, { referenceNumber: idOrRef }]
    }).lean();
    return doc;
  }

  async findPendingByComplaintId(complaintId) {
    const doc = await ReopeningRequestModel.findOne({
      $or: [{ complaintId }, { complaintReference: complaintId }],
      status: REOPENING_STATUS.PENDING_REVIEW
    }).lean();
    return doc;
  }

  async findAll(filters = {}) {
    const query = {};
    if (filters.complaintId) {
      query.$or = [{ complaintId: filters.complaintId }, { complaintReference: filters.complaintId }];
    }
    if (filters.requesterId) {
      query.$or = [{ requesterId: filters.requesterId }, { citizenId: filters.requesterId }];
    }
    if (filters.departmentId && filters.departmentId !== 'ALL') {
      query.departmentId = filters.departmentId;
    }
    if (filters.status && filters.status !== 'ALL') {
      query.status = filters.status;
    }

    const docs = await ReopeningRequestModel.find(query).sort({ createdAt: -1 }).lean();
    return docs;
  }

  async update(id, updates) {
    const doc = await ReopeningRequestModel.findOneAndUpdate(
      { $or: [{ id }, { referenceNumber: id }] },
      { ...updates, updatedAt: new Date() },
      { new: true }
    ).lean();
    return doc;
  }

  async recordDecision(id, { outcome, decision, reason, decisionReason, reviewerId, actorRole }) {
    const current = await this.findById(id);
    if (!current) return null;

    const finalOutcome = outcome || decision;
    const targetStatus =
      finalOutcome === 'APPROVED' ? REOPENING_STATUS.APPROVED : REOPENING_STATUS.REJECTED;

    const { valid, allowed } = validateReopeningStatusTransition(current.status, targetStatus);
    if (!valid) {
      const err = new Error(
        `Invalid reopening status transition from '${current.status}' to '${targetStatus}'. Allowed: ${allowed.join(', ')}`
      );
      err.status = 400;
      err.code = 'INVALID_REOPENING_TRANSITION';
      throw err;
    }

    const now = new Date();
    const finalReason = reason || decisionReason || '';
    const decisionObj = {
      outcome: finalOutcome,
      reason: finalReason,
      reviewerId: reviewerId || 'OFFICER',
      decidedAt: now
    };

    const historyEntry = {
      status: targetStatus,
      timestamp: now,
      actorId: reviewerId || 'OFFICER',
      actorRole: actorRole || 'officer',
      remarks: `Reopening request ${finalOutcome}: ${finalReason}`
    };

    const doc = await ReopeningRequestModel.findOneAndUpdate(
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

export const mongoReopeningRequestRepository = new MongoReopeningRequestRepository();
