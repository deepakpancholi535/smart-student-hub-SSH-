import mongoose from 'mongoose';

const achievementSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    category: { type: String, enum: ['certification', 'internship', 'hackathon', 'workshop', 'competition', 'research', 'volunteering', 'other'], default: 'other' },
    issuer: { type: String, trim: true, maxlength: 160 },
    issueDate: Date,
    credentialId: { type: String, trim: true, maxlength: 120 },
    credentialUrl: { type: String, trim: true, maxlength: 300 },
    description: { type: String, trim: true, maxlength: 1200 },
    certificateKey: String,
    certificateData: { type: Buffer, select: false },
    status: { type: String, enum: ['draft', 'pending', 'verified', 'needs-correction', 'rejected'], default: 'draft', index: true },
    submittedAt: Date,
    feedback: { type: String, trim: true, maxlength: 1000 },
    history: [
      {
        action: { type: String, enum: ['submitted', 'resubmitted', 'verified', 'needs-correction', 'rejected'], required: true },
        reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', select: false },
        feedback: { type: String, trim: true, maxlength: 1000 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

export default mongoose.model('Achievement', achievementSchema);
