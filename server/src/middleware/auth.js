import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { config } from '../config/env.js';
import { asyncHandler, HttpError } from './errors.js';

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const token = req.cookies?.ssh_session;
  if (!token) throw new HttpError(401, 'Please sign in to continue.');

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new HttpError(401, 'Your session has expired. Please sign in again.');
  }

  const user = await User.findById(payload.sub).select('name email roles accountStatus sessionVersion');
  if (!user || user.accountStatus !== 'active') throw new HttpError(401, 'This account is not available.');
  if ((payload.version || 0) !== user.sessionVersion) throw new HttpError(401, 'Your session has expired. Please sign in again.');
  req.user = user;
  next();
});

export function requireRole(role) {
  return (req, _res, next) => {
    if (!req.user?.roles.includes(role)) return next(new HttpError(403, 'You do not have permission to perform this action.'));
    next();
  };
}
