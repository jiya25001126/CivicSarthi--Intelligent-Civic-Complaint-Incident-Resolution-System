import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      index: true,
      lowercase: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required']
    },
    name: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true
    },
    role: {
      type: String,
      required: true,
      enum: ['citizen', 'officer', 'admin'],
      default: 'citizen',
      index: true
    },
    departmentId: {
      type: String,
      default: null,
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    phone: {
      type: String,
      default: null,
      trim: true
    },
    phoneNumber: {
      type: String,
      default: null,
      trim: true
    },
    notificationPreferences: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({
        enabled: true,
        smsOptOut: false,
        whatsappOptOut: false,
        preferredChannel: 'both'
      })
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      }
    },
    toObject: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Department validation for officers
userSchema.pre('validate', function (next) {
  if (this.role === 'officer' && !this.departmentId) {
    this.invalidate('departmentId', 'Department ID is required for officer accounts');
  }
  next();
});

export const UserModel = mongoose.models.User || mongoose.model('User', userSchema);
export default UserModel;
