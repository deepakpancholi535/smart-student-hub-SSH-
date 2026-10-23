import { z } from 'zod';
import { config } from '../config/env.js';
import { HttpError } from '../middleware/errors.js';

export async function generateStructuredAnalysis({ systemPrompt, data, schema, maxTokens = 2048 }) {
  if (!config.cloudflareAccountId || !config.cloudflareApiToken) {
    throw new HttpError(503, 'Resume analysis is not configured yet. Add the Cloudflare Workers AI account ID and API token to the server environment.');
  }

  let response;
  try {
    response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.cloudflareAccountId)}/ai/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.cloudflareApiToken}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(45000),
      body: JSON.stringify({
        model: config.cloudflareModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(data) },
        ],
        response_format: { type: 'json_object' },
        max_tokens: maxTokens,
      }),
    });
  } catch (error) {
    if (error.name === 'TimeoutError') throw new HttpError(504, 'The analysis provider timed out. Please retry.');
    throw new HttpError(502, 'The analysis provider could not be reached. Please retry later.');
  }

  if (response.status === 429) {
    throw new HttpError(429, 'Cloudflare Workers AI reached its current usage limit. Please try again after the limit resets.');
  }
  if (response.status === 403) {
    throw new HttpError(503, 'Cloudflare denied Workers AI access. Check the account ID, API token permissions, and account eligibility.');
  }
  if (!response.ok) {
    console.error('Cloudflare Workers AI analysis returned status:', response.status);
    throw new HttpError(502, 'Cloudflare Workers AI could not complete the analysis. Please retry later.');
  }

  let payload;
  try {
    payload = await response.json();
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      console.error('Cloudflare Workers AI returned no text content; finish reason:', payload.choices?.[0]?.finish_reason || 'unknown');
      throw new TypeError('The provider response did not contain text.');
    }
    return schema.parse(JSON.parse(content));
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Cloudflare Workers AI result validation failed:', error.issues.map((issue) => ({
        path: issue.path.join('.'),
        code: issue.code,
      })));
      throw new HttpError(502, 'The analysis provider returned an invalid result. Please retry.');
    }
    if (error instanceof SyntaxError || error instanceof TypeError) {
      if (error instanceof SyntaxError) console.error('Cloudflare Workers AI returned malformed JSON.');
      throw new HttpError(502, 'The analysis provider returned an invalid result. Please retry.');
    }
    throw error;
  }
}
