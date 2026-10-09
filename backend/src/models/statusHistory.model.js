import mongoose from 'mongoose';
import { COMPLAINT_STATUS } from '../constants/status.constants.js';

const statusHistorySchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    complaintId: {
      type: String,
      required: [true, 'Associated complaint ID is required'],
      index: true
    },
    referenceNumber: {
      type: String,
      required: [true, 'Associated complaint reference number is required'],
      index: true,
      uppercase: true
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    },
    status: {
      type: String,
      required: [true, 'Status is required'],
      enum: Object.values(COMPLAINT_STATUS)
    },
    actorType: {
      type: String,
      enum: ['CITIZEN', 'OFFICER', 'SYSTEM'],
      default: 'CITIZEN'
    },
    remarks: {
      type: String,
      default: '',
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// Fast compound lookup for chronology on individual complaint
statusHistorySchema.index({ referenceNumber: 1, timestamp: -1 });
statusHistorySchema.index({ complaintId: 1, timestamp: -1 });

export const StatusHistoryModel = mongoose.models.StatusHistory || mongoose.model('StatusHistory', statusHistorySchema);
export default StatusHistoryModel;
