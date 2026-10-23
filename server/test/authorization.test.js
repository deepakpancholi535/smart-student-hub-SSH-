import test from 'node:test';
import assert from 'node:assert/strict';

process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:27017/smart-student-hub-tests';
process.env.JWT_SECRET ||= 'local-test-secret-must-have-at-least-32-chars';

const { default: app } = await import('../src/app.js');

test('protected student and faculty routes reject anonymous requests', async (context) => {
  const server = app.listen(0, '127.0.0.1');
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  const origin = `http://127.0.0.1:${port}`;

  for (const [method, path] of [
    ['GET', '/api/auth/me'],
    ['GET', '/api/student/dashboard'],
    ['GET', '/api/student/profile'],
    ['POST', '/api/faculty/achievements/507f1f77bcf86cd799439011/decision'],
  ]) {
    const response = await fetch(`${origin}${path}`, { method });
    assert.equal(response.status, 401, `${method} ${path} must require authentication`);
  }
});
