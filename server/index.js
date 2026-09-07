import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { createAuth } from './auth.js';
import { validateBook, revision } from './books.js';
import { PUBLIC_ROOT, resolveStatic } from './routes.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8' };

export function createApp(options = {}) {
  const pin = options.pin ?? process.env.ADMIN_PIN ?? (process.env.NODE_ENV === 'production' ? '' : '1234');
  if (!/^\d{4}$/.test(pin)) throw new Error('Set ADMIN_PIN to exactly four digits before starting the server.');
  const secure = options.secureCookies ?? process.env.COOKIE_SECURE === 'true';
  const dataDir = options.dataDir ?? process.env.DATA_DIR ?? path.join(ROOT, '.runtime');
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const auth = createAuth({ pin, stateFile: path.join(dataDir, 'security-state.json'), now: options.now, sessionMs: options.sessionMs });
  const bookFile = id => path.join(dataDir, `data-textbook${id}.json`);
  for (const id of ['1', '2']) if (!existsSync(bookFile(id))) writeFileSync(bookFile(id), readFileSync(path.join(ROOT, 'data', `data-textbook${id}.json`)), { mode: 0o600 });
  function json(res, status, value) { res.writeHead(status, { 'Content-Type': MIME['.json'] }); res.end(JSON.stringify(value)); }
  async function body(req, limit) {
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) throw Object.assign(new Error('Use application/json.'), { status: 415 });
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size <= limit) chunks.push(chunk);
    }
    if (size > limit) throw Object.assign(new Error('Request is too large.'), { status: 413 });
    try { return JSON.parse(Buffer.concat(chunks).toString()); }
    catch { throw Object.assign(new Error('Invalid JSON.'), { status: 400 }); }
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self' https://cdn.jsdelivr.net; frame-src https://docs.google.com; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'");
    if (secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    try {
      const url = new URL(req.url, 'http://localhost');
      let pathname;
      try { pathname = decodeURIComponent(url.pathname); } catch { return json(res, 400, { error: 'Invalid URL.' }); }
      const route = pathname.slice(1);
      const asset = resolveStatic(pathname);
      const token = /(?:^|;\s*)hanzi_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
      const session = auth.getSession(token);
      const cookie = (value, age) => `hanzi_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure ? '; Secure' : ''}`;
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
        if (req.headers['sec-fetch-site'] === 'cross-site') return json(res, 403, { error: 'Cross-site requests are not allowed.' });
        if (req.headers.origin) {
          const expected = process.env.PUBLIC_ORIGIN || `${secure ? 'https' : 'http'}://${req.headers.host}`;
          if (req.headers.origin !== expected) return json(res, 403, { error: 'Invalid request origin.' });
        }
      }
      if (route === 'healthz' && req.method === 'GET') return json(res, 200, { ok: true });
      if (route === 'api/status' && req.method === 'GET') return json(res, 200, { authenticated: !!session, pinLength: 4, retryAfter: auth.retryAfter(), ...(session ? { csrfToken: session.csrfToken, expiresAt: session.expiresAt } : {}) });
      if (route === 'api/login' && req.method === 'POST') {
        if (auth.retryAfter()) {
          res.setHeader('Retry-After', auth.retryAfter());
          return json(res, 429, { error: 'Too many attempts. Please wait before trying again.', retryAfter: auth.retryAfter() });
        }
        const request = await body(req, 1024);
        const result = auth.login(request?.pin);
        if (result.status === 200) {
          res.setHeader('Set-Cookie', cookie(result.token, Math.floor((result.expiresAt - (options.now?.() ?? Date.now())) / 1000)));
          return json(res, 200, { success: true });
        }
        if (result.retryAfter) res.setHeader('Retry-After', result.retryAfter);
        return json(res, result.status, { error: result.error, retryAfter: result.retryAfter, attemptsRemaining: result.attemptsRemaining });
      }
      const adminApi = route === 'api/logout' || route.startsWith('api/admin/');
      if ((adminApi || asset?.protected) && !session) {
        if (asset?.page) {
          res.writeHead(303, { Location: '/login?next=' + encodeURIComponent(asset.page + url.search) });
          return res.end();
        }
        return json(res, 401, { error: 'Your session has ended. Sign in again.' });
      }
      if (adminApi && !['GET', 'HEAD'].includes(req.method) && req.headers['x-csrf-token'] !== session.csrfToken) return json(res, 403, { error: 'Invalid session token. Reload and try again.' });
      if (route === 'api/logout' && req.method === 'POST') {
        auth.logout(token);
        res.setHeader('Set-Cookie', cookie('', 0));
        return json(res, 200, { success: true });
      }
      const bookMatch = /^(?:api\/admin\/books\/([12])|data-textbook([12])\.json)$/.exec(route);
      if (bookMatch || route === 'data.json') {
        const id = bookMatch?.[1] || bookMatch?.[2] || '1';
        const data = JSON.parse(readFileSync(bookFile(id), 'utf8'));
        if (req.method === 'GET') {
          res.setHeader('ETag', revision(data));
          return json(res, 200, data);
        }
        if (req.method === 'PUT' && adminApi) {
          const input = await body(req, 2 * 1024 * 1024);
          // Re-read after receiving the request body: a concurrent save may have finished.
          const current = JSON.parse(readFileSync(bookFile(id), 'utf8'));
          if (req.headers['if-match'] !== revision(current)) return json(res, 409, { error: 'This textbook changed in another session. Export your draft, then reload before saving.' });
          let clean;
          try { clean = validateBook(input); } catch (error) { return json(res, 422, { error: error.message }); }
          writeFileSync(bookFile(id) + '.bak', JSON.stringify(current, null, 2), { mode: 0o600 });
          writeFileSync(bookFile(id) + '.tmp', JSON.stringify(clean, null, 2), { mode: 0o600 });
          renameSync(bookFile(id) + '.tmp', bookFile(id));
          res.setHeader('ETag', revision(clean));
          return json(res, 200, { success: true });
        }
        return json(res, 405, { error: 'Method not allowed.' });
      }
      if (asset && ['GET', 'HEAD'].includes(req.method)) {
        if (asset.redirect) { res.writeHead(308, { Location: asset.redirect + url.search }); return res.end(); }
        const extension = path.extname(asset.file);
        res.setHeader('Content-Type', MIME[extension] || 'application/octet-stream');
        if (extension === '.css' || extension === '.js' || extension === '.ttf' || extension === '.svg') {
          res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
        }
        const content = readFileSync(path.join(PUBLIC_ROOT, asset.file));
        res.writeHead(200);
        return res.end(req.method === 'HEAD' ? undefined : content);
      }
      return json(res, 404, { error: 'Page not found.' });
    } catch (error) {
      if (!res.headersSent) json(res, error.status || 500, { error: error.status ? error.message : 'Something went wrong. Please try again.' });
      else res.end();
      if (!error.status) console.error(error);
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  createApp().listen(port, '0.0.0.0', () => console.log(`Hanzi Learning: http://localhost:${port}`));
}
