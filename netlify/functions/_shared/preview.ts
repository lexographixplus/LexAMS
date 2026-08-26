function envValue(name: string) {
  try {
    const value = typeof Netlify !== 'undefined' ? Netlify.env.get(name) : undefined;
    if (value) return value;
  } catch {
    // Fall through to process.env for local and test environments.
  }
  return process.env[name];
}

export function isPreviewDeployment(request: Request) {
  const context = String(envValue('CONTEXT') || '').toLowerCase();
  if (context === 'deploy-preview' || context === 'branch-deploy') return true;

  const hostname = new URL(request.url).hostname.toLowerCase();
  return /^(?:deploy-preview-\d+|[a-z0-9-]+)--[a-z0-9-]+\.netlify\.app$/.test(hostname);
}

export function previewReadOnlyResponse() {
  return Response.json(
    {
      error: 'This demo preview is read-only. No workspace data, billing changes, invitations, or emails can be changed here.',
      code: 'PREVIEW_READ_ONLY',
    },
    { status: 409, headers: { 'cache-control': 'no-store' } },
  );
}
