import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreResumeMatch } from '../src/utils/scoring.js';

test('scores skills at 60% and demonstrated responsibilities at 40%', () => {
  const result = {
    requiredSkills: [
      { matched: true },
      { matched: true },
      { matched: false },
      { matched: false },
    ],
    responsibilities: [
      { demonstrated: true },
      { demonstrated: false },
    ],
  };
  assert.equal(scoreResumeMatch(result), 50);
});

test('returns the full score when every skill and responsibility has evidence', () => {
  const result = {
    requiredSkills: [{ matched: true }],
    responsibilities: [{ demonstrated: true }],
  };
  assert.equal(scoreResumeMatch(result), 100);
});

test('does not return a score when evidence categories are absent', () => {
  assert.throws(() => scoreResumeMatch({ requiredSkills: [], responsibilities: [] }));
});
