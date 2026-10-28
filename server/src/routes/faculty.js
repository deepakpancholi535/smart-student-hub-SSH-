import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import Achievement from '../models/Achievement.js';
import Notification from '../models/Notification.js';
import { asyncHandler, HttpError } from '../middleware/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getStoredFilePath } from '../middleware/uploads.js';

const router = Router();
router.use(requireAuth, requireRole('faculty'));

router.get('/verifications', asyncHandler(async (_req, res) => {
  const requests = await Achievement.find({ status: 'pending' })
    .select('title category issuer issueDate description student submittedAt updatedAt')
    .populate('student', 'name email')
    .sort({ submittedAt: 1 })
    .limit(100);
  res.json({ verifications: requests });
}));

router.get('/achievements/:id/certificate', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid achievement identifier.');
  const achievement = await Achievement.findOne({ _id: req.params.id, status: 'pending' }).select('certificateKey +certificateData title');
  if (!achievement?.certificateData?.length && !achievement?.certificateKey) throw new HttpError(404, 'Pending certificate not found.');
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
