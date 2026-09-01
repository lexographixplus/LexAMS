import { createServer } from 'node:https';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const root = resolve(process.env.LEXAMS_PREVIEW_ROOT || 'dist');
const port = Number(process.env.LEXAMS_PREVIEW_PORT || 4173);
const host = process.env.LEXAMS_PREVIEW_BIND || '0.0.0.0';
const certPath = process.env.LEXAMS_PREVIEW_CERT;
const keyPath = process.env.LEXAMS_PREVIEW_KEY;

if (!certPath || !keyPath) {
  throw new Error('LEXAMS_PREVIEW_CERT and LEXAMS_PREVIEW_KEY are required.');
}

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function safePath(pathname) {
  const decoded = decodeURIComponent(pathname);
  const normalized = normalize(decoded).replace(/^([/\\])+/, '');
  const candidate = resolve(join(root, normalized));
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) return null;
  return candidate;
}

async function readAsset(pathname) {
  const candidate = safePath(pathname);
  if (!candidate) return null;
  try {
    const info = await stat(candidate);
    const filePath = info.isDirectory() ? join(candidate, 'index.html') : candidate;
    return { body: await readFile(filePath), filePath };
  } catch {
    return null;
  }
}

const [cert, key] = await Promise.all([readFile(certPath), readFile(keyPath)]);
const indexPath = join(root, 'index.html');

const server = createServer({ cert, key }, async (request, response) => {
  try {
    const requestUrl = new URL(request.url || '/', 'https://localhost');
    const asset = await readAsset(requestUrl.pathname);
    if (asset) {
      response.writeHead(200, {
        'Content-Type': mimeTypes[extname(asset.filePath)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      response.end(asset.body);
      return;
    }

    // SPA fallback so browser checks can open client-side routes directly.
    const body = await readFile(indexPath);
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    response.end(body);
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(`Preview server error: ${error.message}`);
  }
});

server.listen(port, host, () => {
  console.log(`LexAMS HTTPS preview listening on https://${host}:${port}`);
});
