import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config/env.js';
import authRoutes from './routes/auth.js';
import studentRoutes from './routes/student.js';
import publicRoutes from './routes/public.js';
import facultyRoutes from './routes/faculty.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false }));
app.use('/api/auth', authRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/faculty', facultyRoutes);
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
