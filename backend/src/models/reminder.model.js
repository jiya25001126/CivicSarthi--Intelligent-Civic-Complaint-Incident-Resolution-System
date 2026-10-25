import mongoose from 'mongoose';
import {
  REMINDER_STATUS,
  REMINDER_DELIVERY_CHANNEL,
  REMINDER_DELIVERY_STATUS
} from '../constants/clarification.constants.js';

const reminderSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: [true, 'Reminder ID is required'],
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
    departmentId: {
      type: String,
      required: [true, 'Department ID is required'],
      index: true,
      trim: true
    },
    status: {
      type: String,
      enum: Object.values(REMINDER_STATUS),
      default: REMINDER_STATUS.ACCEPTED,
      index: true
    },
    deliveryChannel: {
      type: String,
      enum: Object.values(REMINDER_DELIVERY_CHANNEL),
      default: REMINDER_DELIVERY_CHANNEL.IN_APP
    },
    deliveryStatus: {
      type: String,
      enum: Object.values(REMINDER_DELIVERY_STATUS),
      default: REMINDER_DELIVERY_STATUS.LOGGED_IN_APP
    },
    requestedAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    cooldownExpiresAt: {
      type: Date,
      required: true
    },
    message: {
      type: String,
      default: 'Reminder recorded in-app for department review.'
    }
  },
  {
    timestamps: true
  }
);

reminderSchema.pre('validate', function (next) {
  if (!this.id) {
    const year = new Date().getFullYear();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.id = `REM-${year}-${Date.now().toString().slice(-4)}${rand}`;
  }
  if (!this.complaintReference && this.complaintId) {
    this.complaintReference = this.complaintId;
  }
  if (!this.cooldownExpiresAt) {
    this.cooldownExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  }
  next();
});

export const ReminderModel =
  mongoose.models.Reminder || mongoose.model('Reminder', reminderSchema);
export default ReminderModel;
