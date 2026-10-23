import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { config } from '../config/env.js';
import { HttpError } from './errors.js';

const uploadRoot = path.resolve(config.uploadDir);
const storage = multer.diskStorage({
  destination: async (_req, _file, callback) => {
    try {
      await fs.mkdir(uploadRoot, { recursive: true });
      callback(null, uploadRoot);
    } catch (error) {
      callback(error);
    }
  },
  filename: (_req, _file, callback) => callback(null, `${crypto.randomUUID()}.pdf`),
});

const imageStorage = multer.memoryStorage();

export const receivePdf = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (path.extname(file.originalname).toLowerCase() !== '.pdf') {
      return callback(new HttpError(400, 'Only PDF files are supported.'));
    }
    callback(null, true);
  },
}).single('file');

const profileImageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(path.extname(file.originalname).toLowerCase())) {
      return callback(new HttpError(400, 'Choose a JPEG, PNG or WebP image.'));
    }
    callback(null, true);
  },
}).single('file');

export function receiveProfileImage(req, res, next) {
  profileImageUpload(req, res, (error) => {
    if (error?.code === 'LIMIT_FILE_SIZE') {
      return next(new HttpError(400, 'Profile pictures must be 2 MB or smaller.'));
    }
    return next(error);
  });
}

export async function inspectProfileImage(file) {
  if (!file) return null;
  let header;
  if (file.buffer) {
    header = file.buffer.subarray(0, 12);
  } else {
    const handle = await fs.open(file.path, 'r');
    const signature = Buffer.alloc(12);
    try {
      const { bytesRead } = await handle.read(signature, 0, signature.length, 0);
      header = signature.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  }

  let mimeType;
  if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) mimeType = 'image/jpeg';
  if (header.length >= 8 && header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) mimeType = 'image/png';
  if (header.length >= 12 && header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP') mimeType = 'image/webp';
  if (!mimeType) {
    if (file.path) await fs.unlink(file.path);
    throw new HttpError(400, 'The uploaded file is not a supported image.');
  }
  return mimeType;
}

export async function assertPdfFile(file) {
  if (!file) return;
  const handle = await fs.open(file.path, 'r');
  let validPdf = false;
  try {
    const signature = Buffer.alloc(5);
    const { bytesRead } = await handle.read(signature, 0, signature.length, 0);
    validPdf = bytesRead === 5 && signature.toString('ascii') === '%PDF-';
  } finally {
    await handle.close();
  }
  if (!validPdf) {
    await fs.unlink(file.path);
    throw new HttpError(400, 'The file content is not a valid PDF.');
  }
}

export async function removeStoredFile(storageKey) {
  if (!storageKey || path.basename(storageKey) !== storageKey) return;
  try {
    await fs.unlink(path.join(uploadRoot, storageKey));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

export function getStoredFilePath(storageKey) {
  if (!storageKey || path.basename(storageKey) !== storageKey) throw new HttpError(404, 'File not found.');
  return path.join(uploadRoot, storageKey);
}
