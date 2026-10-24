import mongoose from 'mongoose';
import { SPAM_RISK_LEVEL, SPAM_REVIEW_STATUS, SPAM_REVIEW_OUTCOMES } from '../constants/spam.constants.js';

const reviewHistoryItemSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    outcome: { type: String, enum: Object.values(SPAM_REVIEW_OUTCOMES), default: null },
    reason: { type: String, required: true },
    actorId: { type: String, required: true },
    actorRole: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  },
  { _id: false }
);

const spamReviewSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: [true, 'Spam Review ID is required'],
      unique: true,
      index: true,
      trim: true
    },
    complaintId: {
      type: String,
      required: [true, 'Complaint ID is required'],
      index: true,
      trim: true
    },
    complaintReference: {
      type: String,
      required: [true, 'Complaint reference is required'],
      index: true,
      trim: true
    },
    referenceNumber: {
      type: String,
      index: true,
      trim: true
    },
    citizenId: {
      type: String,
      required: [true, 'Citizen ID is required'],
      index: true,
      trim: true
    },
    departmentId: {
      type: String,
      required: [true, 'Department ID is required'],
      index: true,
      trim: true
    },
    riskLevel: {
      type: String,
      enum: Object.values(SPAM_RISK_LEVEL),
      required: true,
      index: true
    },
    score: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    reasons: {
      type: [String],
      default: []
    },
    explanations: {
      type: [String],
      default: []
    },
    reviewStatus: {
      type: String,
      enum: [SPAM_REVIEW_STATUS.PENDING, SPAM_REVIEW_STATUS.REVIEWED],
      default: SPAM_REVIEW_STATUS.PENDING,
      index: true
    },
    decision: {
      outcome: { type: String, enum: Object.values(SPAM_REVIEW_OUTCOMES), default: null },
      reason: { type: String, default: null },
      reviewerId: { type: String, default: null },
      reviewerRole: { type: String, default: null },
      decidedAt: { type: Date, default: null }
    },
    duplicateReferences: {
      type: [String],
      default: []
    },
    ruleVersion: {
      type: String,
      default: '1.0.0'
    },
    evaluatedAt: {
      type: Date,
      default: Date.now
    },
    reviewHistory: {
      type: [reviewHistoryItemSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

spamReviewSchema.pre('validate', function (next) {
  if (!this.complaintReference && this.referenceNumber) {
    this.complaintReference = this.referenceNumber;
  }
  if (!this.complaintReference && this.complaintId) {
    this.complaintReference = this.complaintId;
  }
  if (this.reviewStatus === 'PENDING_REVIEW') {
    this.reviewStatus = SPAM_REVIEW_STATUS.PENDING;
  }
  next();
});

export const SpamReviewModel = mongoose.models.SpamReview || mongoose.model('SpamReview', spamReviewSchema);
export default SpamReviewModel;
