const CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_CACHE_ENTRIES = 250;
const cache = new Map();
const leetCodeQuery = `
  query userProfileCalendar($username: String!, $year: Int) {
    matchedUser(username: $username) {
      userCalendar(year: $year) {
        submissionCalendar
      }
    }
  }
`;

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function dateRange(now) {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 364);
  return { start, end, startDate: isoDate(start), endDate: isoDate(end) };
}

function listDates(start, end) {
  const dates = [];
  for (const date = new Date(start); date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
    dates.push(isoDate(date));
  }
  return dates;
}

function normalizeDays(counts, dates) {
  const values = dates.map((date) => ({ date, count: Math.max(0, Number(counts.get(date)) || 0) }));
  const max = Math.max(1, ...values.map((day) => day.count));
  return values.map((day) => ({
    ...day,
    level: day.count === 0 ? 0 : Math.min(4, Math.ceil((day.count / max) * 4)),
  }));
}

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCached(key, value) {
  if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

function getGitHubUsername(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    if (!['github.com', 'www.github.com'].includes(url.hostname.toLowerCase())) return '';
    const match = url.pathname.match(/^\/([A-Za-z0-9-]+)\/?$/);
    return match?.[1] || '';
  } catch {
    return '';
  }
}

export function parseGitHubContributions(markup, dates) {
  const counts = new Map();
  const cells = /<td\b(?=[^>]*\bdata-date="(\d{4}-\d{2}-\d{2})")(?=[^>]*\bdata-level="[0-4]")[^>]*\bid="([^"]+)"[^>]*>/g;
  let cell;
  while ((cell = cells.exec(markup)) !== null) {
    const [, date, id] = cell;
    if (!dates.has(date)) continue;
    const tooltip = new RegExp(`<tool-tip\\b(?=[^>]*\\bfor="${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}")[^>]*>([\\s\\S]*?)<\\/tool-tip>`, 'i')
      .exec(markup.slice(cell.index + cell[0].length));
    const label = tooltip?.[1]?.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').trim();
    const countMatch = label?.match(/([\d,]+)\s+contributions?\b/i);
    if (!label || (!countMatch && !/^no contributions?\b/i.test(label))) {
      throw new Error('GitHub activity data is unavailable.');
    }
    counts.set(date, countMatch ? Number(countMatch[1].replace(/,/g, '')) : 0);
  }

  if (counts.size === 0) throw new Error('No GitHub activity calendar was found for this profile.');
  return counts;
}

export function parseLeetCodeCalendar(calendar, dates) {
  let entries;
  try {
    entries = JSON.parse(calendar);
  } catch {
    throw new Error('LeetCode returned an invalid activity calendar.');
  }
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    throw new Error('LeetCode returned an invalid activity calendar.');
  }
  const counts = new Map();
  for (const [timestamp, value] of Object.entries(entries)) {
    if (!/^\d{1,12}$/.test(timestamp) || !Number.isFinite(Number(value)) || Number(value) < 0) continue;
    const date = isoDate(new Date(Number(timestamp) * 1000));
    if (dates.has(date)) counts.set(date, (counts.get(date) || 0) + Number(value));
  }
  return counts;
}

function unavailable(message) {
  return { status: 'unavailable', message, totalContributions: 0, days: [] };
}

function notLinked(message) {
  return { status: 'not-linked', message, totalContributions: 0, days: [] };
}

async function fetchGitHub(username, range) {
  const key = `github:${username}:${range.startDate}:${range.endDate}`;
  const cached = getCached(key);
  if (cached) return cached;

  try {
    const response = await fetch(
      `https://github.com/users/${encodeURIComponent(username)}/contributions?from=${range.startDate}&to=${range.endDate}`,
      {
        headers: { 'User-Agent': 'SmartStudentHub/1.0 (+https://github.com)' },
        signal: AbortSignal.timeout(12000),
      },
    );
    if (!response.ok) throw new Error(response.status === 404 ? 'GitHub profile not found.' : 'GitHub activity could not be loaded.');

    const markup = await response.text();
    const dates = listDates(range.start, range.end);
    const counts = parseGitHubContributions(markup, new Set(dates));
    const days = normalizeDays(counts, dates);
    const result = { status: 'available', username, totalContributions: days.reduce((total, day) => total + day.count, 0), days };
    setCached(key, result);
    return result;
  } catch (error) {
    return unavailable(error.name === 'TimeoutError' ? 'GitHub took too long to respond. Try again shortly.' : error.message);
  }
}

async function fetchLeetCode(username, range) {
  const key = `leetcode:${username}:${range.startDate}:${range.endDate}`;
  const cached = getCached(key);
  if (cached) return cached;

  try {
    const years = [...new Set([range.start.getUTCFullYear(), range.end.getUTCFullYear()])];
    const responses = await Promise.all(years.map(async (year) => {
      const response = await fetch('https://leetcode.com/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 SmartStudentHub/1.0',
          Referer: 'https://leetcode.com/',
        },
        body: JSON.stringify({
          query: leetCodeQuery,
          variables: { username, year },
        }),
        signal: AbortSignal.timeout(12000),
      });
      if (response.status === 429) throw new Error('LeetCode is temporarily rate-limiting activity requests.');
      if (!response.ok) throw new Error('LeetCode activity could not be loaded.');

      const payload = await response.json();
      if (payload.errors?.length) {
        if (payload.errors.some((item) => /user does not exist|not found/i.test(item.message))) {
          throw new Error('LeetCode profile not found. Check the username.');
        }
        throw new Error('LeetCode activity could not be loaded.');
      }
      const matchedUser = payload.data?.matchedUser;
      if (!matchedUser) throw new Error('LeetCode profile not found. Check the username.');
      return matchedUser.userCalendar?.submissionCalendar || '{}';
    }));

    const dates = listDates(range.start, range.end);
    const dateSet = new Set(dates);
    const combined = new Map();
    for (const calendar of responses) {
      for (const [date, count] of parseLeetCodeCalendar(calendar, dateSet)) {
        combined.set(date, (combined.get(date) || 0) + count);
      }
    }
    const days = normalizeDays(combined, dates);
    const result = { status: 'available', username, totalContributions: days.reduce((total, day) => total + day.count, 0), days };
    setCached(key, result);
    return result;
  } catch (error) {
    return unavailable(error.name === 'TimeoutError' ? 'LeetCode took too long to respond. Try again shortly.' : error.message);
  }
}

export async function getActivityHeatmaps(links = {}, now = new Date()) {
  const range = dateRange(now);
  const githubUsername = getGitHubUsername(links.github);
  const leetcodeUsername = /^[a-z0-9_-]{1,30}$/i.test(links.leetcodeUsername || '')
    ? links.leetcodeUsername.toLowerCase()
    : '';

  const [github, leetcode] = await Promise.all([
    githubUsername
      ? fetchGitHub(githubUsername, range)
      : Promise.resolve(notLinked('Add a valid GitHub profile URL to display your contributions.')),
    leetcodeUsername
      ? fetchLeetCode(leetcodeUsername, range)
      : Promise.resolve(notLinked('Add your LeetCode username to display your submissions.')),
  ]);

  return {
    period: { startDate: range.startDate, endDate: range.endDate },
    github,
    leetcode,
  };
}

export function clearActivityHeatmapCache() {
  cache.clear();
}
