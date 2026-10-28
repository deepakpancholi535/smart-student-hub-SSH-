import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import fs from 'node:fs/promises';
import path from 'node:path';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import Achievement from '../models/Achievement.js';
import Notification from '../models/Notification.js';
import Portfolio from '../models/Portfolio.js';
import ResumeAtsReview from '../models/ResumeAtsReview.js';
import ResumeAnalysis from '../models/ResumeAnalysis.js';
import StudentProfile from '../models/StudentProfile.js';
import User from '../models/User.js';
import { config } from '../config/env.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../middleware/errors.js';
import { assertPdfFile, getStoredFilePath, inspectProfileImage, receivePdf, receiveProfileImage, removeStoredFile } from '../middleware/uploads.js';
import { analyzeResume, extractResumeDocument, extractResumeText } from '../services/resumeAnalyzer.js';
import { reviewResumeForAts } from '../services/resumeAts.js';
import { getPublicPortfolio } from '../services/portfolio.js';
import { getActivityHeatmaps } from '../services/activityHeatmaps.js';

const router = Router();
router.use(requireAuth, requireRole('student'));
const profileActivityLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  keyGenerator: (req) => req.user.id,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'You have refreshed your activity heatmaps too often. Please try again later.' },
});
const resumeAnalysisLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => req.user.id,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'You have reached the hourly analysis limit. Please try again later.' },
});

const linkSchema = z.string().trim().max(300).refine((value) => !value || /^https?:\/\/\S+$/i.test(value), 'Use a valid http or https URL.');
const githubProfileSchema = linkSchema.refine((value) => {
  if (!value) return true;
  try {
    const url = new URL(value);
    return ['github.com', 'www.github.com'].includes(url.hostname.toLowerCase())
      && /^\/[A-Za-z0-9-]+\/?$/.test(url.pathname)
      && !url.search
      && !url.hash;
  } catch {
    return false;
  }
}, 'Enter a GitHub profile URL, such as https://github.com/username.');
const profileSchema = z.object({
  phone: z.string().trim().max(30).optional(),
  department: z.string().trim().max(120).optional(),
  degree: z.string().trim().max(120).optional(),
  graduationYear: z.number().int().min(1950).max(2100).optional().nullable(),
  semester: z.number().int().min(1).max(12).optional().nullable(),
  cgpa: z.number().min(0).max(10).optional().nullable(),
  semesterGrades: z.array(z.object({
    semester: z.number().int().min(1).max(12),
    sgpa: z.number().min(0).max(10),
  })).max(12).refine((grades) => new Set(grades.map((grade) => grade.semester)).size === grades.length, 'A semester can only appear once.').optional(),
  institution: z.string().trim().max(160).optional(),
  summary: z.string().trim().max(1000).optional(),
  careerInterests: z.array(z.string().trim().min(1).max(80)).max(15).optional(),
  skills: z.array(z.object({
    name: z.string().trim().min(1).max(60),
    category: z.enum(['technical', 'soft']).default('technical'),
    level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  })).max(50).optional(),
  links: z.object({
    github: githubProfileSchema.optional(),
    linkedin: linkSchema.optional(),
    portfolio: linkSchema.optional(),
    leetcodeUsername: z.string().trim().toLowerCase().max(30)
      .regex(/^[a-z0-9_-]*$/, 'Use only letters, numbers, underscores or hyphens for your LeetCode username.')
      .optional(),
  }).optional(),
});

async function currentProfile(userId) {
  const user = await User.findById(userId).select('name email roles');
  let profile = await StudentProfile.findOne({ user: userId }).select('+resume.data');
  if (!profile) profile = await StudentProfile.create({ user: userId });
  return { user, profile };
}

function publicProfile(user, profile) {
  const data = profile.toObject();
  delete data.enrollmentNumber;
  if (data.resume) {
    delete data.resume.storageKey;
    delete data.resume.data;
  }
  if (data.profileImage) {
    delete data.profileImage.storageKey;
    delete data.profileImage.data;
  }
  data.profileImageAvailable = Boolean(profile.profileImage?.data?.length || profile.profileImage?.storageKey);
  return { ...data, user: { id: user.id, name: user.name, email: user.email, roles: user.roles } };
}

async function unlinkUpload(file) {
  if (!file?.path) return;
  await fs.unlink(file.path).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  });
}

router.get('/dashboard', asyncHandler(async (req, res) => {
  const { user, profile } = await currentProfile(req.user.id);
  const [achievements, notifications, latestAnalysis] = await Promise.all([
    Achievement.find({ student: user._id }).select('status title updatedAt createdAt').sort({ updatedAt: -1 }).limit(5),
    Notification.find({ recipient: user._id }).sort({ createdAt: -1 }).limit(5),
    ResumeAnalysis.findOne({ student: user._id }).sort({ createdAt: -1 }).select('jobTitle score createdAt'),
  ]);
  const completionFields = [
    Boolean(user.name), Boolean(profile.department), Boolean(profile.graduationYear),
    Boolean(profile.degree || profile.cgpa), profile.skills.length > 0, Boolean(profile.resume?.data?.length || profile.resume?.storageKey),
  ];
  const totalAchievements = await Achievement.countDocuments({ student: user._id });
  const verifiedAchievements = await Achievement.countDocuments({ student: user._id, status: 'verified' });
  const pendingVerifications = await Achievement.countDocuments({ student: user._id, status: 'pending' });
  res.json({
    user: { id: user.id, name: user.name, email: user.email },
    profile: publicProfile(user, profile),
    completion: Math.round((completionFields.filter(Boolean).length / completionFields.length) * 100),
    missingProfileFields: [
      !user.name && 'name', !profile.department && 'department', !profile.graduationYear && 'graduationYear',
      !(profile.degree || profile.cgpa) && 'academic information', profile.skills.length === 0 && 'skills',
      !(profile.resume?.data?.length || profile.resume?.storageKey) && 'resume',
    ].filter(Boolean),
    stats: { totalAchievements, verifiedAchievements, pendingVerifications },
    recentAchievements: achievements,
    recentNotifications: notifications,
    latestAnalysis,
    aiConfigured: Boolean(config.cloudflareAccountId && config.cloudflareApiToken),
  });
}));

router.get('/profile', asyncHandler(async (req, res) => {
  const { user, profile } = await currentProfile(req.user.id);
  res.json({ profile: publicProfile(user, profile) });
}));

router.get('/profile/activity', profileActivityLimit, asyncHandler(async (req, res) => {
  const { profile } = await currentProfile(req.user.id);
  res.json(await getActivityHeatmaps(profile.links || {}));
}));

router.put('/profile', asyncHandler(async (req, res) => {
  const updates = profileSchema.parse(req.body);
  const { user, profile } = await currentProfile(req.user.id);
  Object.assign(profile, updates);
  await profile.save();
  res.json({ profile: publicProfile(user, profile) });
}));

router.post('/profile/image', receiveProfileImage, asyncHandler(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Select a profile picture to upload.');
  let saved = false;
  try {
    const mimeType = await inspectProfileImage(req.file);
    const { profile } = await currentProfile(req.user.id);
    const previousKey = profile.profileImage?.storageKey;
    profile.profileImage = { data: req.file.buffer, mimeType };
    await profile.save();
    saved = true;
    if (previousKey) await removeStoredFile(previousKey);
    res.status(201).json({ profileImageAvailable: true });
  } catch (error) {
    if (!saved) await unlinkUpload(req.file);
    throw error;
  }
}));

router.get('/profile/image', asyncHandler(async (req, res) => {
  const profile = await StudentProfile.findOne({ user: req.user.id }).select('profileImage');
  if (!profile?.profileImage?.data?.length && !profile?.profileImage?.storageKey) {
    throw new HttpError(404, 'No profile picture has been uploaded.');
  }
  let image;
  if (profile.profileImage.data?.length) {
    image = Buffer.from(profile.profileImage.data);
  } else {
    try {
      image = await fs.readFile(getStoredFilePath(profile.profileImage.storageKey));
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new HttpError(410, 'Your saved profile picture is no longer available. Upload it again to restore it.');
      }
      throw error;
    }
  }
  res.type(profile.profileImage.mimeType).set('Cache-Control', 'private, no-store').send(image);
}));

router.delete('/profile/image', asyncHandler(async (req, res) => {
  const profile = await StudentProfile.findOne({ user: req.user.id });
  const previousKey = profile.profileImage?.storageKey;
  profile.profileImage = null;
  await profile.save();
  if (previousKey) await removeStoredFile(previousKey);
  res.status(204).end();
}));

router.post('/resume', receivePdf, asyncHandler(async (req, res) => {
  await assertPdfFile(req.file);
  if (!req.file) throw new HttpError(400, 'Select a PDF resume to upload.');
  const { profile } = await currentProfile(req.user.id);
  const previousKey = profile.resume?.storageKey;
  profile.resume = {
    data: await fs.readFile(req.file.path),
    originalName: path.basename(req.file.originalname).slice(0, 150),
    updatedAt: new Date(),
  };
  await profile.save();
  if (previousKey) await removeStoredFile(previousKey);
  await unlinkUpload(req.file);
  res.status(201).json({ resume: { originalName: profile.resume.originalName, updatedAt: profile.resume.updatedAt } });
}));

router.delete('/resume', asyncHandler(async (req, res) => {
  const profile = await StudentProfile.findOne({ user: req.user.id });
  const previousKey = profile.resume?.storageKey;
  profile.resume = null;
  await profile.save();
  if (previousKey) await removeStoredFile(previousKey);
  res.status(204).end();
}));

router.get('/resume/file', asyncHandler(async (req, res) => {
  const profile = await StudentProfile.findOne({ user: req.user.id });
  if (!profile?.resume?.data?.length && !profile?.resume?.storageKey) throw new HttpError(404, 'No resume has been uploaded.');
  if (profile.resume.data?.length) {
    return res.type('application/pdf')
      .set('Content-Disposition', `attachment; filename="${profile.resume.originalName}"`)
      .send(profile.resume.data);
  }
  res.type('application/pdf').download(getStoredFilePath(profile.resume.storageKey), profile.resume.originalName);
}));

const projectSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1500).optional(),
  technologies: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  githubUrl: linkSchema.optional(),
  demoUrl: linkSchema.optional(),
  type: z.enum(['project', 'internship']).optional(),
  organization: z.string().trim().max(120).optional(),
  duration: z.string().trim().max(100).optional(),
});

router.get('/projects', asyncHandler(async (req, res) => {
  const profile = await StudentProfile.findOne({ user: req.user.id }).select('projects');
  res.json({ projects: profile?.projects || [] });
}));

router.post('/projects', asyncHandler(async (req, res) => {
  const data = projectSchema.parse(req.body);
  const profile = await StudentProfile.findOne({ user: req.user.id });
  if (profile.projects.length >= 30) throw new HttpError(400, 'You can save up to 30 projects or experiences.');
  profile.projects.push(data);
  await profile.save();
  res.status(201).json({ project: profile.projects.at(-1) });
}));

router.put('/projects/:id', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid project identifier.');
  const data = projectSchema.partial().parse(req.body);
  const profile = await StudentProfile.findOne({ user: req.user.id });
  const project = profile.projects.id(req.params.id);
  if (!project) throw new HttpError(404, 'Project not found.');
  Object.assign(project, data);
  await profile.save();
  res.json({ project });
}));

router.delete('/projects/:id', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid project identifier.');
  const profile = await StudentProfile.findOne({ user: req.user.id });
  if (!profile.projects.id(req.params.id)) throw new HttpError(404, 'Project not found.');
  profile.projects.pull(req.params.id);
  await profile.save();
  res.status(204).end();
}));

const achievementFields = z.object({
  title: z.string().trim().min(1).max(160),
  category: z.enum(['certification', 'internship', 'hackathon', 'workshop', 'competition', 'research', 'volunteering', 'other']),
  issuer: z.string().trim().max(160).optional(),
  issueDate: z.string().datetime().optional().or(z.literal('')),
  credentialId: z.string().trim().max(120).optional(),
  credentialUrl: linkSchema.optional(),
  description: z.string().trim().max(1200).optional(),
});

async function parseAchievementFields(body, file, partial = false) {
  const issueDate = body.issueDate ? new Date(body.issueDate) : undefined;
  if (issueDate && Number.isNaN(issueDate.getTime())) {
    await unlinkUpload(file);
    throw new HttpError(400, 'Enter a valid achievement issue date.');
  }
  try {
    return (partial ? achievementFields.partial() : achievementFields).parse({
      ...body,
      ...(issueDate ? { issueDate: issueDate.toISOString() } : {}),
    });
  } catch (error) {
    await unlinkUpload(file);
    throw error;
  }
}

router.get('/achievements', asyncHandler(async (req, res) => {
  const achievements = await Achievement.find({ student: req.user.id }).select('-history.reviewer').sort({ createdAt: -1 });
  res.json({ achievements });
}));

router.post('/achievements', receivePdf, asyncHandler(async (req, res) => {
  await assertPdfFile(req.file);
  const fields = await parseAchievementFields(req.body, req.file);
  const achievement = await Achievement.create({
    ...fields,
    student: req.user.id,
    issueDate: fields.issueDate ? new Date(fields.issueDate) : undefined,
    certificateKey: req.file ? path.basename(req.file.filename) : undefined,
    certificateData: req.file ? await fs.readFile(req.file.path) : undefined,
  });
  await unlinkUpload(req.file);
  res.status(201).json({ achievement });
}));

router.get('/achievements/:id', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid achievement identifier.');
  const achievement = await Achievement.findOne({ _id: req.params.id, student: req.user.id }).select('-history.reviewer');
  if (!achievement) throw new HttpError(404, 'Achievement not found.');
  res.json({ achievement });
}));

router.put('/achievements/:id', receivePdf, asyncHandler(async (req, res) => {
  await assertPdfFile(req.file);
  if (!mongoose.isValidObjectId(req.params.id)) {
    await unlinkUpload(req.file);
    throw new HttpError(400, 'Invalid achievement identifier.');
  }
  const achievement = await Achievement.findOne({ _id: req.params.id, student: req.user.id });
  if (!achievement) {
    await unlinkUpload(req.file);
    throw new HttpError(404, 'Achievement not found.');
  }
  if (!['draft', 'needs-correction', 'rejected'].includes(achievement.status)) {
    await unlinkUpload(req.file);
    throw new HttpError(409, 'Submitted or verified achievements cannot be edited.');
  }
  const fields = await parseAchievementFields(req.body, req.file, true);
  const previousCertificateKey = achievement.certificateKey;
  const { issueDate, ...otherFields } = fields;
  Object.assign(achievement, otherFields);
  if (Object.hasOwn(fields, 'issueDate')) achievement.issueDate = issueDate ? new Date(issueDate) : undefined;
  if (req.file) {
    achievement.certificateKey = path.basename(req.file.filename);
    achievement.certificateData = await fs.readFile(req.file.path);
  }
  if (achievement.status !== 'draft') achievement.status = 'needs-correction';
  await achievement.save();
  if (req.file && previousCertificateKey) await removeStoredFile(previousCertificateKey);
  await unlinkUpload(req.file);
  res.json({ achievement });
}));

router.delete('/achievements/:id', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid achievement identifier.');
  const achievement = await Achievement.findOne({ _id: req.params.id, student: req.user.id });
  if (!achievement) throw new HttpError(404, 'Achievement not found.');
  if (achievement.status !== 'draft') throw new HttpError(409, 'Only draft achievements can be deleted.');
  await achievement.deleteOne();
  if (achievement.certificateKey) await removeStoredFile(achievement.certificateKey);
  res.status(204).end();
}));

router.post('/achievements/:id/submit', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid achievement identifier.');
  const achievement = await Achievement.findOne({ _id: req.params.id, student: req.user.id });
  if (!achievement) throw new HttpError(404, 'Achievement not found.');
  if (!['draft', 'needs-correction', 'rejected'].includes(achievement.status)) {
    throw new HttpError(409, 'This achievement cannot be submitted in its current state.');
  }
  if (!achievement.certificateData?.length && !achievement.certificateKey) throw new HttpError(400, 'Upload a certificate before requesting verification.');
  const action = achievement.status === 'draft' ? 'submitted' : 'resubmitted';
  achievement.status = 'pending';
  achievement.submittedAt = new Date();
  achievement.feedback = '';
  achievement.history.push({ action });
  await achievement.save();
  await Notification.create({
    recipient: req.user.id,
    type: 'verification',
    title: 'Certificate submitted',
    message: `${achievement.title} was submitted for faculty verification.`,
    route: '/student/verification',
  });
  res.json({ achievement });
}));

router.get('/verifications', asyncHandler(async (req, res) => {
  const achievements = await Achievement.find({ student: req.user.id, status: { $ne: 'draft' } })
    .select('title issuer status submittedAt updatedAt feedback history.action history.feedback history.createdAt')
    .sort({ updatedAt: -1 });
  res.json({ verifications: achievements });
}));

router.get('/achievements/:id/certificate', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid achievement identifier.');
  const achievement = await Achievement.findOne({ _id: req.params.id, student: req.user.id }).select('certificateKey +certificateData title');
  if (!achievement?.certificateData?.length && !achievement?.certificateKey) throw new HttpError(404, 'Certificate not found.');
  if (achievement.certificateData?.length) {
    return res.type('application/pdf')
      .set('Content-Disposition', `attachment; filename="${achievement.title}.pdf"`)
      .send(achievement.certificateData);
  }
  res.type('application/pdf').download(getStoredFilePath(achievement.certificateKey), `${achievement.title}.pdf`);
}));

router.get('/notifications', asyncHandler(async (req, res) => {
  const [notifications, unreadCount] = await Promise.all([
    Notification.find({ recipient: req.user.id }).sort({ createdAt: -1 }).limit(100),
    Notification.countDocuments({ recipient: req.user.id, readAt: null }),
  ]);
  res.json({ notifications, unreadCount });
}));

router.patch('/notifications/read-all', asyncHandler(async (req, res) => {
  await Notification.updateMany({ recipient: req.user.id, readAt: null }, { $set: { readAt: new Date() } });
  res.status(204).end();
}));

router.patch('/notifications/:id/read', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid notification identifier.');
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user.id },
    { $set: { readAt: new Date() } },
    { new: true },
  );
  if (!notification) throw new HttpError(404, 'Notification not found.');
  res.json({ notification });
}));

router.post('/portfolio/generate', asyncHandler(async (req, res) => {
  const profile = await StudentProfile.findOne({ user: req.user.id }).populate('user', 'name');
  if (!profile?.user?.name || !profile.summary?.trim() || !profile.skills.length) {
    throw new HttpError(400, 'Add a professional summary and at least one skill to generate your portfolio.');
  }
  let portfolio = await Portfolio.findOne({ student: req.user.id });
  if (!portfolio) {
    const slug = `${profile.user.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'student'}-${randomBytes(8).toString('hex')}`;
    portfolio = await Portfolio.create({ student: req.user.id, slug, isPublic: true });
  } else {
    portfolio.isPublic = true;
    await portfolio.save();
  }
  res.json({ portfolio: { slug: portfolio.slug, isPublic: portfolio.isPublic } });
}));

router.get('/portfolio', asyncHandler(async (req, res) => {
  const portfolio = await Portfolio.findOne({ student: req.user.id }).select('-student');
  res.json({ portfolio });
}));

router.patch('/portfolio/settings', asyncHandler(async (req, res) => {
  const updates = z.object({
    isPublic: z.boolean().optional(),
    showSkills: z.boolean().optional(),
    showProjects: z.boolean().optional(),
    showAchievements: z.boolean().optional(),
    showDepartment: z.boolean().optional(),
    showGraduationYear: z.boolean().optional(),
    showResume: z.boolean().optional(),
  }).parse(req.body);
  const portfolio = await Portfolio.findOneAndUpdate(
    { student: req.user.id },
    { $set: updates },
    { new: true, runValidators: true },
  ).select('-student');
  if (!portfolio) throw new HttpError(404, 'Generate your portfolio before changing its settings.');
  res.json({ portfolio });
}));

router.post('/resume/analyze', resumeAnalysisLimit, receivePdf, asyncHandler(async (req, res) => {
  await assertPdfFile(req.file);
  let jobTitle;
  let jobDescription;
  try {
    jobTitle = z.string().trim().min(2).max(120).parse(req.body.jobTitle);
    jobDescription = z.string().trim().min(100).max(12000).parse(req.body.jobDescription);
  } catch (error) {
    await unlinkUpload(req.file);
    throw error;
  }
  const profile = await StudentProfile.findOne({ user: req.user.id }).select('+resume.data');
  let filePath = req.file?.path;
  let resumeUpdatedAt = profile.resume?.updatedAt;
  if (!req.file && profile.resume?.data?.length) {
    filePath = profile.resume.data;
  } else if (!req.file && profile.resume?.storageKey) {
    filePath = getStoredFilePath(profile.resume.storageKey);
  } else if (!filePath) {
    throw new HttpError(400, 'Upload a PDF or add a resume to your profile before analyzing.');
  }

  let result;
  let score;
  try {
    const resumeText = await extractResumeText(filePath);
    ({ result, score } = await analyzeResume(resumeText, jobDescription));
  } catch (error) {
    await unlinkUpload(req.file);
    throw error;
  }
  if (req.file) {
    const previousKey = profile.resume?.storageKey;
    profile.resume = {
      data: await fs.readFile(req.file.path),
      originalName: path.basename(req.file.originalname).slice(0, 150),
      updatedAt: new Date(),
    };
    await profile.save();
    if (previousKey) await removeStoredFile(previousKey);
    await unlinkUpload(req.file);
    resumeUpdatedAt = profile.resume.updatedAt;
  }
  const analysis = await ResumeAnalysis.create({
    student: req.user.id,
    resumeUpdatedAt,
    jobTitle,
    score,
    result: { ...result, limitations: 'Advisory estimate only. The score weights matched skills at 60% and demonstrated responsibilities at 40%. It is not a hiring probability; review all recommendations.' },
  });
  res.status(201).json({ analysis });
}));

router.post('/resume/ats-check', resumeAnalysisLimit, receivePdf, asyncHandler(async (req, res) => {
  await assertPdfFile(req.file);
  try {
    const profile = await StudentProfile.findOne({ user: req.user.id }).select('+resume.data');
    const filePath = req.file?.path
      || profile?.resume?.data
      || (profile?.resume?.storageKey ? getStoredFilePath(profile.resume.storageKey) : null);
    if (!filePath) throw new HttpError(400, 'Upload a PDF or add a resume to your profile before running an ATS check.');

    const document = await extractResumeDocument(filePath);
    const review = await reviewResumeForAts(document.text, document.pages);
    const savedReview = await ResumeAtsReview.create({
      student: req.user.id,
      resumeUpdatedAt: profile?.resume?.updatedAt,
      score: review.score,
      dimensions: review.dimensions,
      checks: review.checks,
      summary: review.summary,
      issues: review.issues,
      limitations: 'Conservative, evidence-based estimate from extracted PDF text: section headings earn only partial credit, while impact credit depends on multiple bullets, action-led wording, and specific outcomes where relevant. Visual layout cannot be fully assessed from text extraction; ATS products vary, and this is not a guarantee of passing any employer system.',
    });
    res.status(201).json({ review: savedReview });
  } finally {
    await unlinkUpload(req.file);
  }
}));

router.get('/resume/ats-reviews', asyncHandler(async (req, res) => {
  const reviews = await ResumeAtsReview.find({ student: req.user.id })
    .select('score summary createdAt')
    .sort({ createdAt: -1 })
    .limit(30);
  res.json({ reviews, aiConfigured: Boolean(config.cloudflareAccountId && config.cloudflareApiToken) });
}));

router.get('/resume/ats-reviews/:id', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid ATS review identifier.');
  const review = await ResumeAtsReview.findOne({ _id: req.params.id, student: req.user.id });
  if (!review) throw new HttpError(404, 'ATS review not found.');
  res.json({ review });
}));

router.get('/resume/analyses', asyncHandler(async (req, res) => {
  const analyses = await ResumeAnalysis.find({ student: req.user.id })
    .select('jobTitle score createdAt')
    .sort({ createdAt: -1 })
    .limit(30);
  res.json({ analyses, aiConfigured: Boolean(config.cloudflareAccountId && config.cloudflareApiToken) });
}));

router.get('/resume/analyses/:id', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid analysis identifier.');
  const analysis = await ResumeAnalysis.findOne({ _id: req.params.id, student: req.user.id });
  if (!analysis) throw new HttpError(404, 'Analysis not found.');
  res.json({ analysis });
}));

export default router;

export async function publicPortfolioHandler(req, res) {
  const portfolio = await Portfolio.findOne({ slug: req.params.slug, isPublic: true });
  if (!portfolio) throw new HttpError(404, 'This portfolio is unavailable.');
  res.json({ portfolio: await getPublicPortfolio(portfolio) });
}
