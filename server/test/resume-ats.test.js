import test from 'node:test';
import assert from 'node:assert/strict';

process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:27017/smart-student-hub-tests';
process.env.JWT_SECRET ||= 'local-test-secret-must-have-at-least-32-chars';
process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account-id';
process.env.CLOUDFLARE_API_TOKEN = 'test-cloudflare-token';
process.env.CLOUDFLARE_MODEL = '@cf/meta/test-model';

const { reviewResumeForAts, scoreAtsReadiness } = await import('../src/services/resumeAts.js');

const readableResume = [
  '[email removed] [phone removed]',
  'Professional Experience',
  '- Developed accessible web interfaces for 12 community projects.',
  '- Led a team of 4 volunteers and increased event attendance by 20%.',
  '- Documented procedures and supported more than 30 participants.',
  'Education',
  'Bachelor of Arts, 2024',
  'Skills',
  'Communication, project coordination, writing, and customer service',
  'Volunteer Experience',
  ...Array(18).fill('Additional experience coordinating events, supporting community members, and preparing clear written information.'),
].join('\n');

const validReview = {
  summary: 'The resume is readable and has common sections, with opportunities to clarify impact.',
  issues: [
    { category: 'impact', priority: 'medium', title: 'Add context to outcomes', issue: 'Some results lack the scope of the work.', recommendation: 'Add context only when you can verify it.', example: '' },
    { category: 'formatting', priority: 'low', title: 'Keep bullets consistent', issue: 'Bullet formatting can be checked for consistency.', recommendation: 'Use one bullet style throughout.', example: '' },
    { category: 'wording', priority: 'low', title: 'Prefer direct wording', issue: 'Some phrases can be more concise.', recommendation: 'Use direct action-led sentences.', example: '' },
  ],
};

test('scores common resume sections and action-oriented evidence for any profession', () => {
  const report = scoreAtsReadiness(readableResume, 1);
  assert.equal(report.score, 85);
  assert.deepEqual(report.dimensions.map(({ max }) => max), [25, 30, 25, 20]);
  assert.deepEqual(report.dimensions.map(({ score }) => score), [25, 25, 19, 16]);
  assert.equal(report.checks.bulletCount, 3);
  assert.equal(report.checks.actionVerbCount, 3);
  assert.equal(report.checks.sectionCount, 5);
});

test('reduces readiness score when common structure and readable content are absent', () => {
  const report = scoreAtsReadiness('Short note.', 6);
  assert.ok(report.score < 60);
  assert.equal(report.checks.wordCount, 2);
  assert.equal(report.dimensions.reduce((sum, dimension) => sum + dimension.score, 0), report.score);
});

test('does not award full impact credit for a small number of bullets without measurable outcomes', () => {
  const report = scoreAtsReadiness([
    'Experience',
    '- Helped customers and organized daily records.',
    '- Supported the team with routine tasks.',
    'Education',
    'Skills',
  ].join('\n'), 1);
  const impact = report.dimensions.find(({ name }) => name === 'Impact and wording');
  assert.equal(impact.score, 11);
  assert.ok(report.score < 70);
});

test('requests role-neutral ATS feedback and returns prioritized validated suggestions', async (context) => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return Response.json({ choices: [{ message: { content: JSON.stringify(validReview) } }] });
  };
  context.after(() => { globalThis.fetch = originalFetch; });

  const report = await reviewResumeForAts(readableResume, 1);
  assert.equal(report.score, 85);
  assert.equal(report.issues.length, 3);
  assert.equal(report.issues[0].example, '');
  assert.equal(request.url, 'https://api.cloudflare.com/client/v4/accounts/test-account-id/ai/v1/chat/completions');
  const body = JSON.parse(request.options.body);
  assert.match(body.messages[0].content, /technical and non-technical/);
  assert.match(body.messages[0].content, /no job description/);
  assert.equal(body.response_format.type, 'json_object');
  assert.equal(body.max_tokens, 3072);
});
