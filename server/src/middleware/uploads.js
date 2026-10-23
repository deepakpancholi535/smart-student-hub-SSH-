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

const imageStorage = multer.diskStorage({
  destination: storage.destination,
  filename: (_req, _file, callback) => callback(null, `${crypto.randomUUID()}.image`),
});

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

export const receiveProfileImage = multer({
  storage: imageStorage,
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(path.extname(file.originalname).toLowerCase())) {
      return callback(new HttpError(400, 'Choose a JPEG, PNG or WebP image.'));
    }
    callback(null, true);
  },
}).single('file');

export async function inspectProfileImage(file) {
  if (!file) return null;
  const handle = await fs.open(file.path, 'r');
  let mimeType;
  try {
    const signature = Buffer.alloc(12);
    const { bytesRead } = await handle.read(signature, 0, signature.length, 0);
    const header = signature.subarray(0, bytesRead);
    if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) mimeType = 'image/jpeg';
    if (header.length >= 8 && header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) mimeType = 'image/png';
    if (header.length >= 12 && header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP') mimeType = 'image/webp';
  } finally {
    await handle.close();
  }
  if (!mimeType) {
    await fs.unlink(file.path);
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
