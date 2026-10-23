import test from 'node:test';
import assert from 'node:assert/strict';

process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:27017/smart-student-hub-tests';
process.env.JWT_SECRET ||= 'local-test-secret-must-have-at-least-32-chars';
process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account-id';
process.env.CLOUDFLARE_API_TOKEN = 'test-cloudflare-token';
process.env.CLOUDFLARE_MODEL = '@cf/meta/test-model';

const { analyzeResume } = await import('../src/services/resumeAnalyzer.js');
const { config } = await import('../src/config/env.js');

const validResult = {
  summary: 'The resume shows relevant project experience.',
  requiredSkills: [{ name: 'JavaScript', matched: true, evidence: 'Built a web application.' }],
  responsibilities: [{ requirement: 'Build web applications', demonstrated: true, evidence: 'Built a web application.' }],
  qualifications: [{ requirement: 'Degree', status: 'not-mentioned', evidence: '' }],
  suggestions: ['Add more detail about project outcomes.'],
  focusAreas: ['Project outcomes'],
};

test('sends constrained structured analysis to Cloudflare Workers AI and validates the result', async (context) => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return Response.json({
      choices: [{ message: { content: JSON.stringify(validResult) } }],
    });
  };
  context.after(() => { globalThis.fetch = originalFetch; });

  const { result, score } = await analyzeResume('Resume evidence.', 'Job requirements.');
  assert.equal(score, 100);
  assert.deepEqual(result, validResult);
  assert.equal(request.url, 'https://api.cloudflare.com/client/v4/accounts/test-account-id/ai/v1/chat/completions');
  assert.equal(request.options.headers.Authorization, 'Bearer test-cloudflare-token');

  const body = JSON.parse(request.options.body);
  assert.equal(body.model, '@cf/meta/test-model');
  assert.equal(body.response_format.type, 'json_object');
  assert.equal(body.max_tokens, 2048);
  assert.match(body.messages[0].content, /untrusted data/);
  assert.deepEqual(JSON.parse(body.messages[1].content), {
    resume: 'Resume evidence.',
    jobDescription: 'Job requirements.',
  });
});

test('reports Cloudflare usage limits explicitly', async (context) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('', { status: 429 });
  context.after(() => { globalThis.fetch = originalFetch; });

  await assert.rejects(
    analyzeResume('Resume evidence.', 'Job requirements.'),
    (error) => error.status === 429 && /usage limit/.test(error.message),
  );
});

test('reports Cloudflare access denials as a configuration issue', async (context) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('', { status: 403 });
  context.after(() => { globalThis.fetch = originalFetch; });

  await assert.rejects(
    analyzeResume('Resume evidence.', 'Job requirements.'),
    (error) => error.status === 503 && /Cloudflare denied/.test(error.message),
  );
});

test('reports missing Cloudflare credentials without making a provider request', async (context) => {
  const originalFetch = globalThis.fetch;
  const originalAccountId = config.cloudflareAccountId;
  const originalApiToken = config.cloudflareApiToken;
  config.cloudflareAccountId = '';
  config.cloudflareApiToken = '';
  globalThis.fetch = async () => {
    throw new Error('Cloudflare must not be called when credentials are missing.');
  };
  context.after(() => {
    config.cloudflareAccountId = originalAccountId;
    config.cloudflareApiToken = originalApiToken;
    globalThis.fetch = originalFetch;
  });

  await assert.rejects(
    analyzeResume('Resume evidence.', 'Job requirements.'),
    (error) => error.status === 503 && /Cloudflare Workers AI account ID/.test(error.message),
  );
});

test('rejects invalid structured output from Cloudflare Workers AI', async (context) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({
    choices: [{ message: { content: JSON.stringify({ ...validResult, requiredSkills: [] }) } }],
  });
  context.after(() => { globalThis.fetch = originalFetch; });

  await assert.rejects(
    analyzeResume('Resume evidence.', 'Job requirements.'),
    (error) => error.status === 502 && /invalid result/.test(error.message),
  );
});
