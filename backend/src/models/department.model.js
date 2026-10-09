import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: [true, 'Department ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },
    code: {
      type: String,
      required: [true, 'Department code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },
    name: {
      type: String,
      required: [true, 'Department name is required'],
      trim: true
    },
    description: {
      type: String,
      default: '',
      trim: true
    },
    category: {
      type: String,
      required: [true, 'Associated category is required'],
      lowercase: true,
      index: true
    },
    contactEmail: {
      type: String,
      default: '',
      trim: true,
      lowercase: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    slaDays: {
      type: Number,
      default: 15,
      min: [1, 'SLA must be at least 1 day']
    }
  },
  {
    timestamps: true
  }
);

export const DepartmentModel = mongoose.models.Department || mongoose.model('Department', departmentSchema);
export default DepartmentModel;
