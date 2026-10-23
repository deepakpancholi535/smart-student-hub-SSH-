import mongoose from 'mongoose';

const portfolioSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    slug: { type: String, required: true, unique: true, index: true },
    isPublic: { type: Boolean, default: false },
    showSkills: { type: Boolean, default: true },
    showProjects: { type: Boolean, default: true },
    showAchievements: { type: Boolean, default: true },
    showDepartment: { type: Boolean, default: true },
    showGraduationYear: { type: Boolean, default: true },
    showResume: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export default mongoose.model('Portfolio', portfolioSchema);
