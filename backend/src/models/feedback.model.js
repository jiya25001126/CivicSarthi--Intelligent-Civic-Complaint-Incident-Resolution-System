import mongoose from 'mongoose';
import { FEEDBACK_RATING_BOUNDS } from '../constants/feedback.constants.js';

const feedbackEditSchema = new mongoose.Schema(
  {
    previousRating: { type: Number, required: true },
    previousComments: { type: String, default: '' },
    editedAt: { type: Date, default: Date.now },
    editedBy: { type: String, required: true }
  },
  { _id: false }
);

const feedbackSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: [true, 'Feedback ID is required'],
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
      required: [true, 'Complaint reference number is required'],
      index: true,
      trim: true
    },
    referenceNumber: {
      type: String,
      trim: true,
      index: true
    },
    citizenId: {
      type: String,
      required: [true, 'Citizen ID is required'],
      index: true,
      trim: true
    },
    rating: {
      type: Number,
      required: [true, 'Rating from 1 to 5 is required'],
      min: [FEEDBACK_RATING_BOUNDS.MIN, `Rating cannot be less than ${FEEDBACK_RATING_BOUNDS.MIN}`],
      max: [FEEDBACK_RATING_BOUNDS.MAX, `Rating cannot exceed ${FEEDBACK_RATING_BOUNDS.MAX}`]
    },
    comments: {
      type: String,
      trim: true,
      maxlength: [2000, 'Comments cannot exceed 2000 characters'],
      default: ''
    },
    resolutionMilestone: {
      type: String,
      required: [true, 'Resolution cycle identifier is required'],
      trim: true,
      default: '1'
    },
    resolutionDetailsSnapshot: {
      score: { type: Number, default: null },
      outcomeType: { type: String, default: null },
      resolvedAt: { type: String, default: null },
      isException: { type: Boolean, default: false }
    },
    departmentId: {
      type: String,
      default: null,
      trim: true,
      index: true
    },
    isEdited: {
      type: Boolean,
      default: false
    },
    editHistory: {
      type: [feedbackEditSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

// Pre-validate hook to synchronize referenceNumber and guarantee a unique ID if omitted
feedbackSchema.pre('validate', async function (next) {
  if (!this.complaintReference && this.referenceNumber) {
    this.complaintReference = this.referenceNumber;
  }
  if (!this.referenceNumber && this.complaintReference) {
    this.referenceNumber = this.complaintReference;
  }
  if (!this.id) {
    const year = new Date().getFullYear();
    const count = (await mongoose.models.Feedback?.countDocuments?.()) || 0;
    const seq = String(count + 1).padStart(4, '0');
    this.id = `FB-${year}-${seq}`;
  }
  next();
});

// Compound index to ensure uniqueness per complaint, citizen, and milestone
feedbackSchema.index({ complaintId: 1, citizenId: 1, resolutionMilestone: 1 }, { unique: true });

export const FeedbackModel = mongoose.models.Feedback || mongoose.model('Feedback', feedbackSchema);
export default FeedbackModel;
