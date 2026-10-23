import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import User from '../models/User.js';
import StudentProfile from '../models/StudentProfile.js';
import { config } from '../config/env.js';
import { asyncHandler, HttpError } from '../middleware/errors.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const credentialsSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  email: z.string().trim().email().max(254),
  password: z.string().min(10).max(72).refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be no longer than 72 UTF-8 bytes.'),
});
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
  maxAge: 1000 * 60 * 60 * 24 * 7,
};

function setSession(res, user) {
  const token = jwt.sign({ sub: user.id, version: user.sessionVersion }, config.jwtSecret, { expiresIn: '7d', issuer: 'smart-student-hub' });
  res.cookie('ssh_session', token, cookieOptions);
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, roles: user.roles };
}

router.post('/register', asyncHandler(async (req, res) => {
  const data = credentialsSchema.extend({ name: z.string().trim().min(2).max(100) }).parse(req.body);
  const email = data.email.toLowerCase();
  if (await User.exists({ email })) throw new HttpError(409, 'An account with this email already exists.');

  const user = await User.create({
    name: data.name,
    email,
    passwordHash: await bcrypt.hash(data.password, 12),
    roles: ['student'],
  });
  await StudentProfile.create({ user: user._id });
  setSession(res, user);
  res.status(201).json({ user: publicUser(user) });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const data = credentialsSchema.pick({ email: true, password: true }).parse(req.body);
  const user = await User.findOne({ email: data.email.toLowerCase() }).select('+passwordHash name email roles accountStatus sessionVersion');
  if (!user || user.accountStatus !== 'active' || !(await bcrypt.compare(data.password, user.passwordHash))) {
    throw new HttpError(401, 'Email or password is incorrect.');
  }
  setSession(res, user);
  res.json({ user: publicUser(user) });
}));

router.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

router.post('/logout', (_req, res) => {
  res.clearCookie('ssh_session', { ...cookieOptions, maxAge: undefined });
  res.status(204).end();
});

router.put('/password', requireAuth, asyncHandler(async (req, res) => {
  const body = z.object({
    currentPassword: z.string().min(1).max(100),
    newPassword: z.string().min(10).max(72).refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be no longer than 72 UTF-8 bytes.'),
  }).parse(req.body);
  const user = await User.findById(req.user.id).select('+passwordHash');
  if (!(await bcrypt.compare(body.currentPassword, user.passwordHash))) {
    throw new HttpError(400, 'Current password is incorrect.');
  }
  user.passwordHash = await bcrypt.hash(body.newPassword, 12);
  user.sessionVersion += 1;
  await user.save();
  setSession(res, user);
  res.json({ message: 'Password updated.' });
}));

export default router;
