const apiRoot = import.meta.env.VITE_API_URL || '';

export async function api(path, options = {}) {
  const isForm = options.body instanceof FormData;
  const response = await fetch(`${apiRoot}/api${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  });

  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || 'The request could not be completed.');
  return payload;
}

export const json = (method, body) => ({ method, body: JSON.stringify(body) });
