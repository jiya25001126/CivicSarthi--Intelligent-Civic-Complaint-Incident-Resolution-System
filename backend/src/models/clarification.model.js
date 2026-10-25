import mongoose from 'mongoose';
import { CLARIFICATION_STATUS, CLARIFICATION_TYPE } from '../constants/clarification.constants.js';

const clarificationResponseSchema = new mongoose.Schema(
  {
    response: {
      type: String,
      required: true,
      trim: true
    },
    responderId: {
      type: String,
      required: true,
      trim: true
    },
    responderName: {
      type: String,
      default: 'Department Officer',
      trim: true
    },
    responderRole: {
      type: String,
      default: 'officer',
      trim: true
    },
    respondedAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const clarificationSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: [true, 'Clarification ID is required'],
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
    citizenId: {
      type: String,
      required: [true, 'Citizen ID is required'],
      index: true,
      trim: true
    },
    citizenName: {
      type: String,
      default: 'Citizen',
      trim: true
    },
    departmentId: {
      type: String,
      required: [true, 'Department ID is required'],
      index: true,
      trim: true
    },
    requestType: {
      type: String,
      enum: Object.values(CLARIFICATION_TYPE),
      default: CLARIFICATION_TYPE.CLARIFICATION,
      required: true
    },
    content: {
      type: String,
      required: [true, 'Clarification content is required'],
      trim: true
    },
    status: {
      type: String,
      enum: Object.values(CLARIFICATION_STATUS),
      default: CLARIFICATION_STATUS.OPEN,
      index: true
    },
    responses: {
      type: [clarificationResponseSchema],
      default: []
    },
    closedAt: {
      type: Date,
      default: null
    },
    closedBy: {
      type: String,
      default: null
    },
    closedReason: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

clarificationSchema.pre('validate', function (next) {
  if (!this.id) {
    const year = new Date().getFullYear();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.id = `CLR-${year}-${Date.now().toString().slice(-4)}${rand}`;
  }
  if (!this.complaintReference && this.complaintId) {
    this.complaintReference = this.complaintId;
  }
  next();
});

export const ClarificationModel =
  mongoose.models.Clarification || mongoose.model('Clarification', clarificationSchema);
export default ClarificationModel;
