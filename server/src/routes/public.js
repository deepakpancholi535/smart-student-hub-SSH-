import { Router } from 'express';
import Portfolio from '../models/Portfolio.js';
import StudentProfile from '../models/StudentProfile.js';
import { asyncHandler } from '../middleware/errors.js';
import { getStoredFilePath } from '../middleware/uploads.js';
import { publicPortfolioHandler } from './student.js';

const router = Router();
router.get('/portfolios/:slug', asyncHandler(publicPortfolioHandler));
router.get('/portfolios/:slug/resume', asyncHandler(async (req, res) => {
  const portfolio = await Portfolio.findOne({ slug: req.params.slug, isPublic: true, showResume: true });
  if (!portfolio) return res.status(404).json({ message: 'Resume download is not available.' });
  const profile = await StudentProfile.findOne({ user: portfolio.student }).select('resume +resume.data');
  if (!profile?.resume?.data?.length && !profile?.resume?.storageKey) return res.status(404).json({ message: 'Resume download is not available.' });
  if (profile.resume.data?.length) {
    return res.type('application/pdf')
      .set('Content-Disposition', `attachment; filename="${profile.resume.originalName}"`)
      .send(profile.resume.data);
  }
  res.type('application/pdf').download(getStoredFilePath(profile.resume.storageKey), profile.resume.originalName);
}));
export default router;
