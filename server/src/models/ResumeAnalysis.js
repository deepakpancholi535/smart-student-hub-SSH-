import mongoose from 'mongoose';

const resumeAnalysisSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    resumeUpdatedAt: Date,
    jobTitle: { type: String, required: true, maxlength: 120 },
    score: { type: Number, required: true, min: 0, max: 100 },
    result: {
      summary: String,
      requiredSkills: [{ name: String, matched: Boolean, evidence: String }],
      responsibilities: [{ requirement: String, demonstrated: Boolean, evidence: String }],
      qualifications: [{ requirement: String, status: { type: String, enum: ['demonstrated', 'not-mentioned', 'unclear'] }, evidence: String }],
      suggestions: [String],
      focusAreas: [String],
      limitations: String,
    },
  },
  { timestamps: true },
);

resumeAnalysisSchema.index({ student: 1, createdAt: -1 });
export default mongoose.model('ResumeAnalysis', resumeAnalysisSchema);
