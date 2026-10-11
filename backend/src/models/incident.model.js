import mongoose from 'mongoose';
import { INCIDENT_STATUS, INCIDENT_PRIORITY } from '../constants/incident.constants.js';

const incidentLocationSchema = new mongoose.Schema(
  {
    locality: {
      type: String,
      default: '',
      trim: true
    },
    district: {
      type: String,
      default: 'Pune',
      trim: true
    },
    state: {
      type: String,
      default: 'Maharashtra',
      trim: true
    },
    coordinates: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null }
    }
  },
  { _id: false }
);

const incidentSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: [true, 'Incident ID is required'],
      unique: true,
      index: true,
      trim: true
    },
    title: {
      type: String,
      required: [true, 'Incident title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [300, 'Title cannot exceed 300 characters']
    },
    description: {
      type: String,
      required: [true, 'Incident description is required'],
      trim: true
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      lowercase: true,
      index: true
    },
    priority: {
      type: String,
      required: true,
      enum: Object.values(INCIDENT_PRIORITY),
      default: INCIDENT_PRIORITY.MEDIUM,
      index: true
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(INCIDENT_STATUS),
      default: INCIDENT_STATUS.ACTIVE,
      index: true
    },
    leadDepartment: {
      type: String,
      required: [true, 'Lead department is required'],
      trim: true,
      index: true
    },
    participatingDepartments: {
      type: [String],
      default: []
    },
    linkedComplaints: {
      type: [String],
      default: [],
      index: true
    },
    location: {
      type: incidentLocationSchema,
      default: () => ({})
    },
    createdBy: {
      type: String,
      default: 'SYSTEM',
      trim: true
    },
    resolutionSummary: {
      type: String,
      default: null,
      trim: true
    },
    resolvedAt: {
      type: Date,
      default: null
    },
    closedAt: {
      type: Date,
      default: null
    },
    synthetic: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

incidentSchema.index({ status: 1, priority: 1 });
incidentSchema.index({ leadDepartment: 1, status: 1 });
incidentSchema.index({ createdAt: -1 });

export const IncidentModel = mongoose.models.Incident || mongoose.model('Incident', incidentSchema);
export default IncidentModel;
