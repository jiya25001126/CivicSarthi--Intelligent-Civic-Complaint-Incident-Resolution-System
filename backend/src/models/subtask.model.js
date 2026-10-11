import mongoose from 'mongoose';
import { SUBTASK_STATUS } from '../constants/incident.constants.js';

const subtaskSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: [true, 'Subtask ID is required'],
      unique: true,
      index: true,
      trim: true
    },
    incidentId: {
      type: String,
      required: [true, 'Parent incident ID is required'],
      index: true,
      trim: true
    },
    complaintId: {
      type: String,
      default: null,
      index: true,
      trim: true
    },
    title: {
      type: String,
      required: [true, 'Subtask title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [300, 'Title cannot exceed 300 characters']
    },
    department: {
      type: String,
      required: [true, 'Target department is required'],
      trim: true,
      index: true
    },
    assignedOfficerId: {
      type: String,
      default: function () {
        return this.officerId || null;
      },
      trim: true,
      index: true
    },
    officerId: {
      type: String,
      default: function () {
        return this.assignedOfficerId || null;
      },
      trim: true
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(SUBTASK_STATUS),
      default: SUBTASK_STATUS.PENDING,
      index: true
    },
    dueDate: {
      type: Date,
      default: null
    },
    completedAt: {
      type: Date,
      default: null
    },
    remarks: {
      type: String,
      default: '',
      trim: true
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

// Synchronize assignedOfficerId and legacy officerId aliases synchronously
subtaskSchema.pre('validate', function () {
  if (!this.assignedOfficerId && this.officerId) {
    this.assignedOfficerId = this.officerId;
  }
  if (!this.officerId && this.assignedOfficerId) {
    this.officerId = this.assignedOfficerId;
  }
});

subtaskSchema.index({ incidentId: 1, status: 1 });
subtaskSchema.index({ department: 1, status: 1 });
subtaskSchema.index({ createdAt: -1 });

export const SubtaskModel = mongoose.models.Subtask || mongoose.model('Subtask', subtaskSchema);
export default SubtaskModel;
