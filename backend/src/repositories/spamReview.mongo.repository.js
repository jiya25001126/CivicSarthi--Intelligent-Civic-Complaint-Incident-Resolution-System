import SpamReviewModel from '../models/spamReview.model.js';
import { SPAM_REVIEW_STATUS } from '../constants/spam.constants.js';

export class MongoSpamReviewRepository {
  async create(data) {
    const doc = new SpamReviewModel(data);
    const saved = await doc.save();
    return saved.toObject();
  }

  async findById(id) {
    if (!id) return null;
    const doc = await SpamReviewModel.findOne({ id }).lean();
    return doc;
  }

  async findByComplaintId(complaintId) {
    if (!complaintId) return null;
    const doc = await SpamReviewModel.findOne({
      $or: [{ complaintId }, { complaintReference: complaintId }]
    }).lean();
    return doc;
  }

  async findAll(filters = {}) {
    const query = {};

    if (filters.departmentId) {
      query.departmentId = filters.departmentId.toUpperCase();
    }
    const statusVal = filters.reviewStatus || filters.status;
    if (statusVal && statusVal !== 'ALL') {
      const normalized = (statusVal === 'PENDING_REVIEW' || statusVal === 'PENDING')
        ? ['PENDING', 'PENDING_REVIEW']
        : (statusVal === 'RESOLVED' || statusVal === 'REVIEWED')
          ? ['REVIEWED', 'RESOLVED']
          : [statusVal];
      query.reviewStatus = { $in: normalized };
    }
    if (filters.riskLevel && filters.riskLevel !== 'ALL') {
      query.riskLevel = filters.riskLevel;
    }
    if (filters.citizenId) {
      query.citizenId = filters.citizenId;
    }
    if (filters.complaintId) {
      query.$or = [{ complaintId: filters.complaintId }, { complaintReference: filters.complaintId }];
    }

    const docs = await SpamReviewModel.find(query).sort({ createdAt: -1 }).lean();
    return docs;
  }

  async update(id, updates) {
    const doc = await SpamReviewModel.findOneAndUpdate(
      { id },
      { ...updates, updatedAt: new Date() },
      { new: true }
    ).lean();
    return doc;
  }

  async recordDecision(id, { outcome, reason, reviewerId, reviewerRole }) {
    const now = new Date();
    const decisionObj = {
      outcome,
      reason,
      reviewerId: reviewerId || 'OFFICER',
      reviewerRole: reviewerRole || 'officer',
      decidedAt: now
    };

    const historyEntry = {
      action: 'HUMAN_REVIEW_DECISION',
      outcome,
      reason,
      actorId: reviewerId || 'OFFICER',
      actorRole: reviewerRole || 'officer',
      timestamp: now
    };

    const doc = await SpamReviewModel.findOneAndUpdate(
      { id },
      {
        $set: {
          reviewStatus: SPAM_REVIEW_STATUS.REVIEWED,
          decision: decisionObj,
          updatedAt: now
        },
        $push: { reviewHistory: historyEntry }
      },
      { new: true }
    ).lean();

    return doc;
  }
}

export const mongoSpamReviewRepository = new MongoSpamReviewRepository();
