import mongoose from 'mongoose';
import {
  NOTIFICATION_CHANNEL,
  NOTIFICATION_STATUS,
  NOTIFICATION_EVENT
} from '../constants/notification.constants.js';

const notificationLogSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: [true, 'Notification ID is required'],
      unique: true,
      index: true,
      trim: true
    },
    recipientPhone: {
      type: String,
      required: [true, 'Recipient phone number is required'],
      index: true,
      trim: true
    },
    channel: {
      type: String,
      enum: Object.values(NOTIFICATION_CHANNEL),
      required: true,
      index: true
    },
    eventType: {
      type: String,
      enum: Object.values(NOTIFICATION_EVENT),
      required: true,
      index: true
    },
    complaintId: {
      type: String,
      index: true,
      trim: true,
      default: null
    },
    complaintReference: {
      type: String,
      index: true,
      trim: true,
      default: null
    },
    citizenId: {
      type: String,
      index: true,
      trim: true,
      default: null
    },
    status: {
      type: String,
      enum: Object.values(NOTIFICATION_STATUS),
      default: NOTIFICATION_STATUS.PENDING,
      index: true
    },
    provider: {
      type: String,
      default: 'mock'
    },
    providerMessageId: {
      type: String,
      default: null
    },
    messageBody: {
      type: String,
      default: null
    },
    templateName: {
      type: String,
      default: null
    },
    idempotencyKey: {
      type: String,
      index: true,
      trim: true
    },
    attempts: {
      type: Number,
      default: 1
    },
    error: {
      type: String,
      default: null
    },
    sentAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

notificationLogSchema.index({ idempotencyKey: 1, createdAt: -1 });

export const NotificationLog =
  mongoose.models.NotificationLog || mongoose.model('NotificationLog', notificationLogSchema);
export default NotificationLog;

