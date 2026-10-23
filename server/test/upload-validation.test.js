import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:27017/smart-student-hub-tests';
process.env.JWT_SECRET ||= 'local-test-secret-must-have-at-least-32-chars';

const { assertPdfFile, inspectProfileImage } = await import('../src/middleware/uploads.js');

test('rejects and removes files without the PDF signature', async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ssh-upload-test-'));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, 'not-a-pdf.pdf');
  await fs.writeFile(filePath, 'plain text');

  await assert.rejects(assertPdfFile({ path: filePath }), { status: 400, message: 'The file content is not a valid PDF.' });
  await assert.rejects(fs.stat(filePath), { code: 'ENOENT' });
});

test('rejects and removes image uploads with unsupported content', async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ssh-image-test-'));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, 'not-an-image.png');
  await fs.writeFile(filePath, 'plain text');

  await assert.rejects(inspectProfileImage({ path: filePath }), { status: 400, message: 'The uploaded file is not a supported image.' });
  await assert.rejects(fs.stat(filePath), { code: 'ENOENT' });
});

test('accepts supported image signatures rather than trusting the filename', async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ssh-valid-image-test-'));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, 'picture.upload');
  await fs.writeFile(filePath, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

  assert.equal(await inspectProfileImage({ path: filePath }), 'image/png');
});

test('accepts validated in-memory images for durable profile storage', async () => {
  const buffer = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(await inspectProfileImage({ buffer }), 'image/png');
});

test('rejects unsupported in-memory image content', async () => {
  await assert.rejects(
    inspectProfileImage({ buffer: Buffer.from('not an image') }),
    { status: 400, message: 'The uploaded file is not a supported image.' },
  );
});
