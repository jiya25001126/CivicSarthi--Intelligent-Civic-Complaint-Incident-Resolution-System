import mongoose from 'mongoose';
import { CITIZEN_REPUTATION_STATUS, REPUTATION_EVENT_TYPES } from '../constants/spam.constants.js';

const reputationEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true },
    eventType: { type: String, enum: Object.values(REPUTATION_EVENT_TYPES), required: true },
    complaintId: { type: String, default: null },
    reason: { type: String, required: true },
    reviewerId: { type: String, default: null },
    delta: { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now }
  },
  { _id: false }
);

const citizenReputationSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: [true, 'Reputation ID is required'],
      unique: true,
      index: true,
      trim: true
    },
    citizenId: {
      type: String,
      required: [true, 'Citizen ID is required'],
      unique: true,
      index: true,
      trim: true
    },
    standing: {
      type: String,
      enum: Object.values(CITIZEN_REPUTATION_STATUS),
      default: CITIZEN_REPUTATION_STATUS.GOOD_STANDING,
      index: true
    },
    score: {
      type: Number,
      default: 100,
      min: 0,
      max: 100
    },
    totalSubmissions: {
      type: Number,
      default: 0
    },
    flaggedCount: {
      type: Number,
      default: 0
    },
    confirmedAbuseCount: {
      type: Number,
      default: 0
    },
    clearedLegitimateCount: {
      type: Number,
      default: 0
    },
    events: {
      type: [reputationEventSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

export const CitizenReputationModel = mongoose.models.CitizenReputation || mongoose.model('CitizenReputation', citizenReputationSchema);
export default CitizenReputationModel;
