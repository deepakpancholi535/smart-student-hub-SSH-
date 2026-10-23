import pdf from 'pdf-parse';
import { z } from 'zod';
import { config } from '../config/env.js';
import { HttpError } from '../middleware/errors.js';
import { scoreResumeMatch } from '../utils/scoring.js';

const responseSchema = z.object({
  summary: z.string().min(1).max(1200),
  requiredSkills: z.array(z.object({
    name: z.string().min(1).max(100),
    matched: z.boolean(),
    evidence: z.string().max(400),
  })).min(1).max(30),
  responsibilities: z.array(z.object({
    requirement: z.string().min(1).max(240),
    demonstrated: z.boolean(),
    evidence: z.string().max(400),
  })).min(1).max(20),
  qualifications: z.array(z.object({
    requirement: z.string().min(1).max(240),
    status: z.enum(['demonstrated', 'not-mentioned', 'unclear']),
    evidence: z.string().max(400),
  })).max(20),
  suggestions: z.array(z.string().min(1).max(400)).max(10),
  focusAreas: z.array(z.string().min(1).max(240)).max(5),
});

function redactPersonalData(text) {
  return text
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email removed]')
    .replace(/\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, '[phone removed]');
}

export async function extractResumeText(filePath) {
  let parsed;
  try {
    parsed = await pdf(filePath);
  } catch {
    throw new HttpError(422, 'We could not read this PDF. Please try another text-based PDF.');
  }
  const text = parsed.text.replace(/\s+/g, ' ').trim();
  if (text.length < 80) {
    throw new HttpError(422, 'This PDF contains too little selectable text. Scanned or image-only PDFs are not supported yet.');
  }
  return redactPersonalData(text).slice(0, 24000);
}

export async function analyzeResume(resumeText, jobDescription) {
  if (!config.aiApiKey) throw new HttpError(503, 'Resume analysis is not configured yet. An administrator must add an AI provider key.');

  let response;
  try {
    response = await fetch(config.aiApiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.aiApiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(45000),
      body: JSON.stringify({
        model: config.aiModel,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'Compare the supplied resume and job description using only their evidence. Return a JSON object with: summary, requiredSkills (name, matched, evidence), responsibilities (requirement, demonstrated, evidence), qualifications (requirement, status: demonstrated|not-mentioned|unclear, evidence), suggestions, focusAreas. Never invent qualifications or metrics. A missing resume mention means not-mentioned, not that the student lacks the skill. Include at least one skill and responsibility. Keep evidence brief and grounded in the resume.',
          },
          {
            role: 'user',
            content: JSON.stringify({ resume: resumeText, jobDescription }),
          },
        ],
      }),
    });
  } catch (error) {
    if (error.name === 'TimeoutError') throw new HttpError(504, 'The analysis provider timed out. Please retry.');
    throw new HttpError(502, 'The analysis provider could not be reached. Please retry later.');
  }

  if (response.status === 429) throw new HttpError(429, 'The analysis provider is rate-limiting requests. Please try again shortly.');
  if (!response.ok) {
    console.error('Resume analysis provider returned status:', response.status);
    throw new HttpError(502, 'The analysis provider could not complete the request.');
  }

  let payload;
  try {
    payload = await response.json();
    const content = payload.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content);
    const result = responseSchema.parse(parsed);
    const score = scoreResumeMatch(result);
    return { result, score };
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError || error instanceof TypeError) {
      throw new HttpError(502, 'The analysis provider returned an invalid result. Please retry.');
    }
    throw error;
  }
}
