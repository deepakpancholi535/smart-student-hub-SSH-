import mongoose from 'mongoose';

const issueSchema = new mongoose.Schema(
  {
    category: { type: String, enum: ['parsing', 'structure', 'formatting', 'wording', 'impact', 'consistency'], required: true },
    priority: { type: String, enum: ['high', 'medium', 'low'], required: true },
    title: { type: String, required: true, maxlength: 120 },
    issue: { type: String, required: true, maxlength: 500 },
    recommendation: { type: String, required: true, maxlength: 600 },
    example: { type: String, maxlength: 400 },
  },
  { _id: false },
);

const dimensionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, maxlength: 80 },
    score: { type: Number, required: true, min: 0, max: 30 },
    max: { type: Number, required: true, min: 1, max: 30 },
    detail: { type: String, required: true, maxlength: 240 },
  },
  { _id: false },
);

const resumeAtsReviewSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    resumeUpdatedAt: Date,
    score: { type: Number, required: true, min: 0, max: 100 },
    dimensions: { type: [dimensionSchema], required: true },
    checks: {
      pages: { type: Number, required: true },
      wordCount: { type: Number, required: true },
      sectionCount: { type: Number, required: true },
      bulletCount: { type: Number, required: true },
      actionVerbCount: { type: Number, required: true },
      quantifiedBulletCount: { type: Number, required: true },
    },
    summary: { type: String, required: true, maxlength: 1200 },
    issues: { type: [issueSchema], required: true },
    limitations: { type: String, required: true, maxlength: 600 },
  },
  { timestamps: true },
);

resumeAtsReviewSchema.index({ student: 1, createdAt: -1 });
export default mongoose.model('ResumeAtsReview', resumeAtsReviewSchema);
