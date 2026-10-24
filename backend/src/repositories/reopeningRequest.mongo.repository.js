import ReopeningRequestModel from '../models/reopeningRequest.model.js';
import {
  REOPENING_STATUS,
  validateReopeningStatusTransition
} from '../constants/feedback.constants.js';

export class MongoReopeningRequestRepository {
  async generateRequestId() {
    const year = new Date().getFullYear();
    const count = await ReopeningRequestModel.countDocuments();
    const seq = String(count + 1).padStart(4, '0');
    let candidate = `REOPEN-${year}-${seq}`;
    const exists = await ReopeningRequestModel.findOne({ id: candidate }).lean();
    if (exists) {
      const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
      candidate = `REOPEN-${year}-${Date.now().toString().slice(-4)}${rand}`;
    }
    return candidate;
  }

  async generateRequestReference() {
    const year = new Date().getFullYear();
    const count = await ReopeningRequestModel.countDocuments();
    const seq = String(count + 1).padStart(4, '0');
    let candidate = `REQ-${year}-${seq}`;
    const exists = await ReopeningRequestModel.findOne({ referenceNumber: candidate }).lean();
    if (exists) {
      const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
      candidate = `REQ-${year}-${Date.now().toString().slice(-4)}${rand}`;
    }
    return candidate;
  }

  async create(data) {
    const id = data.id || (await this.generateRequestId());
    const referenceNumber = data.referenceNumber || (await this.generateRequestReference());
    const requesterId = data.requesterId || data.citizenId;
    const citizenId = data.citizenId || data.requesterId;
    const complaintReference = data.complaintReference || data.complaintId;
    const doc = new ReopeningRequestModel({
      ...data,
      id,
      referenceNumber,
      requesterId,
      citizenId,
      complaintReference
    });
    const saved = await doc.save();
    return saved.toObject ? saved.toObject() : saved;
  }

  async findById(idOrRef) {
    const doc = await ReopeningRequestModel.findOne({
      $or: [
        { id: { $regex: new RegExp(`^${idOrRef}$`, 'i') } },
        { referenceNumber: { $regex: new RegExp(`^${idOrRef}$`, 'i') } }
      ]
    }).lean();
    return doc;
  }

  async findPendingByComplaintId(complaintId) {
    const esc = String(complaintId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const doc = await ReopeningRequestModel.findOne({
      $or: [
        { complaintId: { $regex: new RegExp(`^${esc}$`, 'i') } },
        { complaintReference: { $regex: new RegExp(`^${esc}$`, 'i') } }
      ],
      status: REOPENING_STATUS.PENDING_REVIEW
    }).lean();
    return doc;
  }

  async findAll(filters = {}) {
    const query = {};
    if (filters.complaintId) {
      const esc = String(filters.complaintId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { complaintId: { $regex: new RegExp(`^${esc}$`, 'i') } },
        { complaintReference: { $regex: new RegExp(`^${esc}$`, 'i') } }
      ];
    }
    const requester = filters.requesterId || filters.citizenId;
    if (requester) {
      const esc = String(requester).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { requesterId: { $regex: new RegExp(`^${esc}$`, 'i') } },
        { citizenId: { $regex: new RegExp(`^${esc}$`, 'i') } }
      ];
    }
    if (filters.departmentId && filters.departmentId !== 'ALL') {
      const esc = String(filters.departmentId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.departmentId = { $regex: new RegExp(`^${esc}$`, 'i') };
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
