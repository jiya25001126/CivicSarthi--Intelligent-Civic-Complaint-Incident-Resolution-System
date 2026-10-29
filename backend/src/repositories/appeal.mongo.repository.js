import AppealModel from '../models/appeal.model.js';
import { APPEAL_STATUS, validateAppealStatusTransition } from '../constants/feedback.constants.js';

export class MongoAppealRepository {
  async generateAppealId() {
    const year = new Date().getFullYear();
    const count = await AppealModel.countDocuments();
    const seq = String(count + 1).padStart(4, '0');
    let candidate = `APP-${year}-${seq}`;
    const exists = await AppealModel.findOne({ id: candidate }).lean();
    if (exists) {
      const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
      candidate = `APP-${year}-${Date.now().toString().slice(-4)}${rand}`;
    }
    return candidate;
  }

  async generateAppealReference() {
    const year = new Date().getFullYear();
    const count = await AppealModel.countDocuments();
    const seq = String(count + 1).padStart(4, '0');
    let candidate = `APL-${year}-${seq}`;
    const exists = await AppealModel.findOne({ referenceNumber: candidate }).lean();
    if (exists) {
      const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
      candidate = `APL-${year}-${Date.now().toString().slice(-4)}${rand}`;
    }
    return candidate;
  }

  async create(data) {
    const id = data.id || (await this.generateAppealId());
    const referenceNumber = data.referenceNumber || (await this.generateAppealReference());
    const requesterId = data.requesterId || data.citizenId;
    const citizenId = data.citizenId || data.requesterId;
    const complaintReference = data.complaintReference || data.complaintId;
    const doc = new AppealModel({
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
    const doc = await AppealModel.findOne({
      $or: [
        { id: { $regex: new RegExp(`^${idOrRef}$`, 'i') } },
        { referenceNumber: { $regex: new RegExp(`^${idOrRef}$`, 'i') } }
      ]
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
