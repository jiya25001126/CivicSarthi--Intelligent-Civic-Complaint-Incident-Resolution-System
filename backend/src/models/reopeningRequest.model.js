import mongoose from 'mongoose';
import { REOPENING_STATUS, REOPENING_REASONS } from '../constants/feedback.constants.js';

const reopeningStatusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    actorId: { type: String, required: true },
    actorRole: { type: String, required: true },
    remarks: { type: String, default: '' }
  },
  { _id: false }
);

const reopeningRequestSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: [true, 'Reopening Request ID is required'],
      unique: true,
      index: true,
      trim: true
    },
    referenceNumber: {
      type: String,
      required: [true, 'Request reference number is required'],
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
    requesterId: {
      type: String,
      required: [true, 'Requester ID is required'],
      index: true,
      trim: true
    },
    citizenId: {
      type: String,
      index: true,
      trim: true
    },
    departmentId: {
      type: String,
      required: [true, 'Department ID is required'],
      index: true,
      trim: true
    },
    reasonCategory: {
      type: String,
      required: [true, 'Reopening reason category is required'],
      enum: Object.values(REOPENING_REASONS)
    },
    explanation: {
      type: String,
      required: [true, 'Explanation is required'],
      trim: true,
      minlength: [10, 'Explanation must be at least 10 characters'],
      maxlength: [3000, 'Explanation cannot exceed 3000 characters']
    },
    citizenExplanation: {
      type: String,
      trim: true
    },
    evidence: {
      type: [String],
      default: []
    },
    resolutionMilestone: {
      type: String,
      default: '1',
      trim: true
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(REOPENING_STATUS),
      default: REOPENING_STATUS.PENDING_REVIEW,
      index: true
    },
    statusHistory: {
      type: [reopeningStatusHistorySchema],
      default: []
    },
    decision: {
      outcome: { type: String, enum: ['APPROVED', 'REJECTED'], default: null },
      reason: { type: String, default: null },
      reviewerId: { type: String, default: null },
      decidedAt: { type: Date, default: null }
    }
  },
  {
    timestamps: true
  }
);

reopeningRequestSchema.pre('validate', function (next) {
  if (!this.requesterId && this.citizenId) {
    this.requesterId = this.citizenId;
  }
  if (!this.citizenId && this.requesterId) {
    this.citizenId = this.requesterId;
  }
  if (!this.complaintReference && this.complaintId) {
    this.complaintReference = this.complaintId;
  }
  if (!this.explanation && this.citizenExplanation) {
    this.explanation = this.citizenExplanation;
  }
  if (!this.citizenExplanation && this.explanation) {
    this.citizenExplanation = this.explanation;
  }
  if (!this.id) {
    const year = new Date().getFullYear();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.id = `REOPEN-${year}-${Date.now().toString().slice(-4)}${rand}`;
  }
  if (!this.referenceNumber) {
    const year = new Date().getFullYear();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.referenceNumber = `REQ-${year}-${Date.now().toString().slice(-4)}${rand}`;
  }
  next();
});

reopeningRequestSchema.index({ complaintId: 1, status: 1 });
reopeningRequestSchema.index({ departmentId: 1, status: 1 });

export const ReopeningRequestModel =
  mongoose.models.ReopeningRequest || mongoose.model('ReopeningRequest', reopeningRequestSchema);
export default ReopeningRequestModel;
