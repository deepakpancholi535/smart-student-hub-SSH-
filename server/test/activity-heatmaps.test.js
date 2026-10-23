import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearActivityHeatmapCache,
  getActivityHeatmaps,
  parseGitHubContributions,
  parseLeetCodeCalendar,
} from '../src/services/activityHeatmaps.js';

test('parses GitHub contribution counts from date-linked tooltips', () => {
  const markup = [
    '<td data-date="2026-10-22" data-level="2" id="day-1"></td>',
    '<tool-tip for="day-1">12 contributions on October 22nd.</tool-tip>',
    '<td data-date="2026-10-23" data-level="0" id="day-2"></td>',
    '<tool-tip for="day-2">No contributions on October 23rd.</tool-tip>',
  ].join('');

  assert.deepEqual(
    [...parseGitHubContributions(markup, new Set(['2026-10-22', '2026-10-23']))],
    [['2026-10-22', 12], ['2026-10-23', 0]],
  );
});

test('ignores GitHub calendar entries outside the displayed period', () => {
  const markup = '<td data-date="2025-10-22" data-level="1" id="outside"></td><tool-tip for="outside">2 contributions on October 22nd.</tool-tip>';
  assert.throws(() => parseGitHubContributions(markup, new Set(['2026-10-22'])), /No GitHub activity calendar/);
});

test('parses LeetCode Unix-second submission dates into calendar-day counts', () => {
  const timestamp = Math.floor(Date.parse('2026-10-23T00:00:00.000Z') / 1000);
  const counts = parseLeetCodeCalendar(JSON.stringify({
    [timestamp]: 4,
    invalid: 500,
    [timestamp + 86400]: -1,
  }), new Set(['2026-10-23']));

  assert.deepEqual([...counts], [['2026-10-23', 4]]);
});

test('returns clear not-linked states when no profile URLs are saved', async () => {
  clearActivityHeatmapCache();
  const result = await getActivityHeatmaps({}, new Date('2026-10-23T12:00:00.000Z'));

  assert.equal(result.period.startDate, '2025-10-24');
  assert.equal(result.period.endDate, '2026-10-23');
  assert.equal(result.github.status, 'not-linked');
  assert.equal(result.leetcode.status, 'not-linked');
});

test('does not fetch invalid GitHub links or malformed LeetCode usernames', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('The provider must not be called for invalid profiles.');
  };
  try {
    const result = await getActivityHeatmaps({
      github: 'https://github.com/octocat/tree/main',
      leetcodeUsername: 'name/with/path',
    });
    assert.equal(result.github.status, 'not-linked');
    assert.equal(result.leetcode.status, 'not-linked');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
