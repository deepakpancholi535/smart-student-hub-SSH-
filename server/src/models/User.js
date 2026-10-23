import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    roles: { type: [String], enum: ['student', 'faculty', 'recruiter', 'placement-officer', 'admin'], default: ['student'] },
    accountStatus: { type: String, enum: ['active', 'disabled'], default: 'active' },
    sessionVersion: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export default mongoose.model('User', userSchema);
