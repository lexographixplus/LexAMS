export async function publicApi(kind, token, options = {}) {
  const response = await fetch(`/api/public/${encodeURIComponent(kind)}/${encodeURIComponent(token)}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'This public link could not be processed.');
  return body;
}
