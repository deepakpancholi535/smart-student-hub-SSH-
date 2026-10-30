import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 1500 },
    technologies: [{ type: String, trim: true, maxlength: 50 }],
    githubUrl: { type: String, trim: true, maxlength: 300 },
    demoUrl: { type: String, trim: true, maxlength: 300 },
    type: { type: String, enum: ['project', 'internship'], default: 'project' },
    organization: { type: String, trim: true, maxlength: 120 },
    duration: { type: String, trim: true, maxlength: 100 },
  },
  { timestamps: true },
);

const resumeSchema = new mongoose.Schema(
  {
    storageKey: String,
    data: { type: Buffer, select: false },
    originalName: String,
    updatedAt: Date,
  },
  { _id: false },
);

const profileImageSchema = new mongoose.Schema(
  {
    storageKey: String,
    data: Buffer,
    mimeType: { type: String, enum: ['image/jpeg', 'image/png', 'image/webp'] },
  },
  { _id: false },
);

const profileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    phone: { type: String, trim: true, maxlength: 30 },
    department: { type: String, trim: true, maxlength: 120 },
    degree: { type: String, trim: true, maxlength: 120 },
    graduationYear: { type: Number, min: 1950, max: 2100 },
    semester: { type: Number, min: 1, max: 12 },
    cgpa: { type: Number, min: 0, max: 10 },
    semesterGrades: [{
      semester: { type: Number, min: 1, max: 12, required: true },
      sgpa: { type: Number, min: 0, max: 10, required: true },
    }],
    institution: { type: String, trim: true, maxlength: 160 },
    branch: { type: String, enum: ['CSE', 'IT', 'IoT', 'AI', 'DS', 'ME', 'EE', 'CE', 'ECE'] },
    section: { type: String, enum: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('') },
    group: { type: String, enum: ['1', '2'] },
    assignmentLocked: { type: Boolean, default: false },
    enrollmentNumber: { type: String, trim: true, maxlength: 60, select: false },
    summary: { type: String, trim: true, maxlength: 1000 },
    careerInterests: [{ type: String, trim: true, maxlength: 80 }],
    skills: [
      {
        name: { type: String, required: true, trim: true, maxlength: 60 },
        category: { type: String, enum: ['technical', 'soft'], default: 'technical' },
        level: { type: String, enum: ['beginner', 'intermediate', 'advanced'] },
      },
    ],
    links: {
      github: { type: String, trim: true, maxlength: 300 },
      linkedin: { type: String, trim: true, maxlength: 300 },
      portfolio: { type: String, trim: true, maxlength: 300 },
      leetcodeUsername: { type: String, trim: true, lowercase: true, maxlength: 30 },
    },
    projects: { type: [projectSchema], default: [] },
    resume: { type: resumeSchema, default: null },
    profileImage: { type: profileImageSchema, default: null },
  },
  { timestamps: true },
);

export default mongoose.model('StudentProfile', profileSchema);
