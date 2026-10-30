import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    roles: { type: [String], enum: ['student', 'faculty', 'recruiter', 'placement-officer', 'admin'], default: ['student'] },
    accountStatus: { type: String, enum: ['active', 'disabled'], default: 'active' },
    sessionVersion: { type: Number, default: 0 },
    facultyAssignment: {
      branch: { type: String, enum: ['CSE', 'IT', 'IoT', 'AI', 'DS', 'ME', 'EE', 'CE', 'ECE'] },
      section: { type: String, enum: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('') },
      group: { type: String, enum: ['1', '2'] },
      locked: { type: Boolean, default: false },
    },
  },
  { timestamps: true },
);

userSchema.index(
  { 'facultyAssignment.branch': 1, 'facultyAssignment.section': 1, 'facultyAssignment.group': 1 },
  {
    unique: true,
    partialFilterExpression: {
      roles: 'faculty',
      'facultyAssignment.branch': { $exists: true },
      'facultyAssignment.section': { $exists: true },
      'facultyAssignment.group': { $exists: true },
    },
  },
);

export default mongoose.model('User', userSchema);
