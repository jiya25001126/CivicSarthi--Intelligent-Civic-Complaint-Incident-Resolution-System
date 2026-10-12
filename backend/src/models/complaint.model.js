import mongoose from 'mongoose';
import { COMPLAINT_STATUS, COMPLAINT_PRIORITY, COMPLAINT_CATEGORIES } from '../constants/status.constants.js';

const officerNoteSchema = new mongoose.Schema(
  {
    note: {
      type: String,
      required: [true, 'Officer note content is required'],
      trim: true,
      maxlength: [2000, 'Officer note cannot exceed 2000 characters']
    },
    officerId: {
      type: String,
      default: 'OFFICER_ADMIN'
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const statusHistoryEntrySchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(COMPLAINT_STATUS)
    },
    actorType: {
      type: String,
      enum: ['CITIZEN', 'OFFICER', 'SYSTEM'],
      default: 'CITIZEN'
    },
    remarks: {
      type: String,
      default: ''
    }
  },
  { _id: false }
);

const complaintSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true
    },
    referenceNumber: {
      type: String,
      required: [true, 'Reference number is required'],
      unique: true,
      index: true,
      trim: true,
      uppercase: true
    },
    title: {
      type: String,
      required: [true, 'Complaint title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    description: {
      type: String,
      required: [true, 'Complaint description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters'],
      maxlength: [3000, 'Description cannot exceed 3000 characters']
    },
    text: {
      type: String,
      trim: true
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      lowercase: true,
      enum: COMPLAINT_CATEGORIES,
      index: true
    },
    state: {
      type: String,
      required: true,
      default: 'Maharashtra'
    },
    district: {
      type: String,
      required: true,
      default: 'Pune'
    },
    locality: {
      type: String,
      default: ''
    },
    preferredLanguage: {
      type: String,
      default: 'en'
    },
    language: {
      type: String,
      default: 'en'
    },
    departmentId: {
      type: String,
      required: [true, 'Target department ID is required'],
      index: true
    },
    department: {
      type: String
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(COMPLAINT_STATUS),
      default: COMPLAINT_STATUS.SUBMITTED,
      index: true
    },
    officialStatus: {
      type: String,
      default: 'RECEIVED'
    },
    priority: {
      type: String,
      required: true,
      enum: Object.values(COMPLAINT_PRIORITY),
      default: COMPLAINT_PRIORITY.MEDIUM,
      index: true
    },
    reassignments: {
      type: Number,
      default: 0
    },
    citizenReminders: {
      type: Number,
      default: 0
    },
    evidence: {
      type: [String],
      default: []
    },
    citizenId: {
      type: String,
      default: 'SYNTHETIC_CPGRAMS_DEMO',
      index: true
    },
    assignedOfficerId: {
      type: String,
      default: null
    },
    citizenName: {
      type: String,
      trim: true
    },
    citizenEmail: {
      type: String,
      trim: true,
      lowercase: true
    },
    citizenPhone: {
      type: String,
      trim: true
    },
    citizenAddress: {
      type: String,
      trim: true
    },
    officerNotes: {
      type: [officerNoteSchema],
      default: []
    },
    statusHistory: {
      type: [statusHistoryEntrySchema],
      default: []
    },
    synthetic: {
      type: Boolean,
      default: false
    },
    intelligence: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    duplicateOf: {
      type: String,
      default: null
    },
    incidentId: {
      type: String,
      default: null,
      index: true
    },
    resolutionDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Synchronize text and department aliases prior to validation
complaintSchema.pre('validate', function (next) {
  if (!this.text && this.description) {
    this.text = this.description;
  }
  if (!this.department && this.departmentId) {
    this.department = this.departmentId;
  }
  if (!this.id && this.referenceNumber) {
    this.id = this.referenceNumber;
  }
  next();
});

// Compound indexes for optimal search and queue performance
complaintSchema.index({ citizenId: 1, createdAt: -1 });
complaintSchema.index({ departmentId: 1, status: 1 });
complaintSchema.index({ category: 1, createdAt: -1 });
complaintSchema.index({ createdAt: -1 });

export const ComplaintModel = mongoose.models.Complaint || mongoose.model('Complaint', complaintSchema);
export default ComplaintModel;
