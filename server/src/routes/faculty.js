import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import Achievement from '../models/Achievement.js';
import Notification from '../models/Notification.js';
import StudentProfile from '../models/StudentProfile.js';
import { asyncHandler, HttpError } from '../middleware/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getStoredFilePath } from '../middleware/uploads.js';
import { BRANCHES, GROUPS, SECTIONS } from '../config/assignments.js';

const router = Router();
router.use(requireAuth, requireRole('faculty'));

router.get('/assignment', asyncHandler(async (req, res) => {
  const assignment = req.user.facultyAssignment;
  res.json({ assignment: assignment?.locked ? assignment : null });
}));

router.put('/assignment', asyncHandler(async (req, res) => {
  const data = z.object({
    branch: z.enum(BRANCHES),
    section: z.enum(SECTIONS),
    group: z.enum(GROUPS),
  }).parse(req.body);
  if (req.user.facultyAssignment?.locked) {
    throw new HttpError(409, 'Your counselor assignment is locked. Ask an administrator to change it.');
  }
  req.user.facultyAssignment = { ...data, locked: true };
  try {
    await req.user.save();
  } catch (error) {
    if (error.code === 11000) throw new HttpError(409, 'That batch already has a counselor assigned.');
    throw error;
  }
  res.json({ assignment: req.user.facultyAssignment });
}));

router.get('/verifications', asyncHandler(async (req, res) => {
  const assignment = req.user.facultyAssignment;
  if (!assignment?.locked) return res.json({ verifications: [], assignmentRequired: true });
  const students = await StudentProfile.find({
    branch: assignment.branch,
    section: assignment.section,
    group: assignment.group,
  }).select('user');
  const requests = await Achievement.find({ status: 'pending', student: { $in: students.map(({ user }) => user) } })
    .populate('student', 'name email')
    .select('title category issuer issueDate description student submittedAt updatedAt')
    .sort({ submittedAt: 1 })
    .limit(100);
  res.json({ verifications: requests, assignmentRequired: false });
}));

router.get('/achievements/:id/certificate', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid achievement identifier.');
  const achievement = await Achievement.findOne({ _id: req.params.id, status: 'pending' }).select('certificateKey +certificateData title student');
  if (!achievement?.certificateData?.length && !achievement?.certificateKey) throw new HttpError(404, 'Pending certificate not found.');
  const assignment = req.user.facultyAssignment;
  const studentProfile = await StudentProfile.findOne({ user: achievement.student }).select('branch section group');
  if (!assignment?.locked || !studentProfile
    || studentProfile.branch !== assignment.branch
    || studentProfile.section !== assignment.section
    || studentProfile.group !== assignment.group) {
    throw new HttpError(403, 'This request is not assigned to your counselor batch.');
  }
  if (achievement.certificateData?.length) {
    return res.type('application/pdf')
      .set('Content-Disposition', `attachment; filename="${achievement.title}.pdf"`)
      .send(achievement.certificateData);
  }
  res.type('application/pdf').download(getStoredFilePath(achievement.certificateKey), `${achievement.title}.pdf`);
}));

router.post('/achievements/:id/decision', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid achievement identifier.');
  const decision = z.object({
    status: z.enum(['verified', 'needs-correction', 'rejected']),
    feedback: z.string().trim().max(1000).optional(),
  }).parse(req.body);
  if (decision.status !== 'verified' && !decision.feedback?.trim()) {
    throw new HttpError(400, 'Provide feedback when requesting a correction or rejecting a submission.');
  }
  const achievement = await Achievement.findOne({ _id: req.params.id, status: 'pending' });
  if (!achievement) throw new HttpError(404, 'Pending verification request not found.');
  const studentProfile = await StudentProfile.findOne({ user: achievement.student }).select('branch section group');
  if (!studentProfile || !req.user.facultyAssignment
    || studentProfile.branch !== req.user.facultyAssignment.branch
    || studentProfile.section !== req.user.facultyAssignment.section
    || studentProfile.group !== req.user.facultyAssignment.group) {
    throw new HttpError(403, 'This request is not assigned to your counselor batch.');
  }
  if (achievement.student.equals(req.user._id)) {
    throw new HttpError(403, 'You cannot verify your own achievement.');
  }

  achievement.status = decision.status;
  achievement.feedback = decision.feedback || '';
  achievement.history.push({
    action: decision.status,
    reviewer: req.user._id,
    feedback: decision.feedback || '',
  });
  await achievement.save();
  await Notification.create({
    recipient: achievement.student,
    type: 'verification',
    title: decision.status === 'verified' ? 'Certificate verified' : decision.status === 'rejected' ? 'Certificate not approved' : 'Certificate needs correction',
    message: decision.status === 'verified'
      ? `${achievement.title} was verified by faculty.`
      : `${achievement.title}: ${decision.feedback}`,
    route: '/student/verification',
  });
  res.json({ achievement });
}));

export default router;
