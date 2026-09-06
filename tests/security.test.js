import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createAuth } from '../server/auth.js';
import { createApp } from '../server/index.js';
import { PAGES, LEGACY_PAGES } from '../server/routes.js';
import { validateBook } from '../public/admin/shared/validation.js';

function authFixture(t, options = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'hanzi-auth-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  let time = 1000000;
  const config = { pin: '1234', stateFile: path.join(dir, 'security.json'), now: () => time, ...options };
  return { auth: createAuth(config), config, advance(ms) { time += ms; } };
}

test('five failures cause a persistent cooldown, which doubles after expiry', t => {
  const fixture = authFixture(t);
  let auth = fixture.auth;
  for (let i = 0; i < 4; i++) assert.equal(auth.login('0000').status, 401);
  assert.equal(auth.login('0000').retryAfter, 300);
  assert.equal(auth.login('1234').status, 429);
  auth = createAuth(fixture.config);
  assert.equal(auth.login('1234').status, 429, 'restart must not bypass cooldown');
  fixture.advance(300000);
  for (let i = 0; i < 4; i++) assert.equal(auth.login('9999').status, 401);
  assert.equal(auth.login('9999').retryAfter, 600);
  fixture.advance(600000);
  assert.equal(auth.login('1234').status, 200);
  assert.equal(auth.retryAfter(), 0);
  for (let i = 0; i < 5; i++) auth.login('0000');
  assert.equal(auth.retryAfter(), 300, 'successful login resets escalation');
});

test('cooldown caps at one hour and malformed PINs count as failures', t => {
  const { auth, advance } = authFixture(t);
  for (const seconds of [300, 600, 1200, 2400, 3600, 3600]) {
    for (const value of [null, 1234, '12345', {}, 'abcd']) auth.login(value);
    assert.equal(auth.retryAfter(), seconds);
    advance(seconds * 1000);
  }
});

test('random sessions expire, logout revokes, and restart invalidates tokens', t => {
  const { auth, config, advance } = authFixture(t);
  const one = auth.login('1234');
  const two = auth.login('1234');
  assert.notEqual(one.token, two.token);
  assert.ok(auth.getSession(one.token));
  assert.equal(auth.getSession('1234'), null);
  auth.logout(one.token);
  assert.equal(auth.getSession(one.token), null);
  assert.equal(createAuth(config).getSession(two.token), null);
  advance(3600001);
  assert.equal(auth.getSession(two.token), null);
});

async function serverFixture(t, options = {}) {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'hanzi-http-'));
  const server = createApp({ pin: '1234', dataDir, ...options });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); rmSync(dataDir, { recursive: true, force: true }); });
  const request = (route, options = {}) => fetch(origin + route, { redirect: 'manual', ...options });
  async function login() {
    const res = await request('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: '{"pin":"1234"}' });
    assert.equal(res.status, 200);
    const cookie = res.headers.get('Set-Cookie').split(';')[0];
    const status = await request('/api/status', { headers: { Cookie: cookie } });
    const info = await status.json();
    return { cookie, csrf: info.csrfToken, fullCookie: res.headers.get('Set-Cookie') };
  }
  return { request, login, origin, dataDir };
}

test('admin pages, scripts, and APIs are gated; private files and reset endpoints are unavailable', async t => {
  const { request } = await serverFixture(t);
  for (const route of ['/admin', '/admin/editor', '/admin/index.html', '/admin/editor/index.html', '/admin1.html', '/maker.html', '/testmaker.html', '/%61dmin1.html']) {
    const response = await request(route);
    assert.equal(response.status, 303, route);
    assert.match(response.headers.get('Location'), /^\/login\?/);
  }
  for (const route of ['/admin/script.js', '/admin/editor/script.js', '/admin/shared/session.js', '/admin/shared/validation.js', '/admin/style.css', '/api/admin/books/1']) assert.equal((await request(route)).status, 401, route);
  for (const route of ['/.env', '/server/index.js', '/.runtime/security-state.json', '/package.json', '/.git/config', '/README.md']) assert.equal((await request(route)).status, 404, route);
  for (const route of ['/api/login/reset-request', '/api/login/reset-verify', '/api/setup', '/api/change-pin']) assert.equal((await request(route, { method: 'POST' })).status, 404);
  for (const route of ['/', '/login', '/data-textbook1.json', '/assets/fonts/mozilla-text-400.ttf', '/progress', '/shared/scores.js', '/progress/script.js', '/assets/fonts/material-symbols.ttf']) assert.equal((await request(route)).status, 200, route);
});

test('login issues HttpOnly/SameSite cookies; CSRF/origin checks protect writes and logout', async t => {
  const { request, login } = await serverFixture(t, { now: () => 1000000 });
  const { cookie, csrf, fullCookie } = await login();
  assert.match(fullCookie, /HttpOnly/); assert.match(fullCookie, /SameSite=Strict/); assert.match(fullCookie, /Max-Age=3600/);
  assert.equal((await request('/admin', { headers: { Cookie: cookie } })).status, 200);
  assert.equal((await request('/api/logout', { method: 'POST', headers: { Cookie: cookie } })).status, 403);
  assert.equal((await request('/api/logout', { method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': csrf, Origin: 'https://attacker.example' } })).status, 403);
  assert.equal((await request('/api/login', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{"pin":"1234"}' })).status, 415);
  const logout = await request('/api/logout', { method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': csrf } });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('Set-Cookie'), /Max-Age=0/);
  assert.equal((await request('/api/status', { headers: { Cookie: cookie } }).then(r => r.json())).authenticated, false);
});

test('secure deployment cookies and expired sessions', async t => {
  let time = 1000000;
  const { request } = await serverFixture(t, { secureCookies: true, now: () => time, sessionMs: 1000 });
  const res = await request('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"pin":"1234"}' });
  assert.match(res.headers.get('Set-Cookie'), /; Secure/);
  const cookie = res.headers.get('Set-Cookie').split(';')[0];
  time += 1001;
  assert.equal((await request('/admin/script.js', { headers: { Cookie: cookie } })).status, 401);
});

test('HTTP cooldown resists parallel guesses and cookie/client changes', async t => {
  const { request } = await serverFixture(t);
  const guesses = await Promise.all(Array.from({ length: 12 }, (_, i) => request('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `10.0.0.${i}` }, body: '{"pin":"0000"}' })));
  assert.equal(guesses.filter(r => r.status === 401).length, 4);
  assert.equal(guesses.filter(r => r.status === 429).length, 8);
  const correct = await request('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"pin":"1234"}' });
  assert.equal(correct.status, 429);
  assert.ok(Number(correct.headers.get('Retry-After')) > 0);
  assert.ok((await request('/api/status').then(r => r.json())).retryAfter > 0);
});

test('textbook saves validate, persist, back up, and reject stale edits', async t => {
  const { request, login, dataDir } = await serverFixture(t);
  const { cookie, csrf } = await login();
  const original = await request('/api/admin/books/1', { headers: { Cookie: cookie } });
  const oldTag = original.headers.get('ETag');
  const data = await original.json();
  const oldTitle = data.units[0].title;
  data.units[0].title = 'Updated unit';
  const headers = { Cookie: cookie, 'X-CSRF-Token': csrf, 'Content-Type': 'application/json', 'If-Match': oldTag };
  const save = await request('/api/admin/books/1', { method: 'PUT', headers, body: JSON.stringify(data) });
  assert.equal(save.status, 200, await save.text());
  assert.notEqual(save.headers.get('ETag'), oldTag);
  assert.equal((await request('/data-textbook1.json').then(r => r.json())).units[0].title, 'Updated unit');
  assert.equal(JSON.parse(readFileSync(path.join(dataDir, 'data-textbook1.json.bak'))).units[0].title, oldTitle);
  assert.equal((await request('/api/admin/books/1', { method: 'PUT', headers, body: JSON.stringify(data) })).status, 409);
  headers['If-Match'] = save.headers.get('ETag');
  assert.equal((await request('/api/admin/books/1', { method: 'PUT', headers, body: '{"units":"bad"}' })).status, 422);
  assert.equal((await request('/api/admin/books/1', { method: 'PUT', headers, body: '{oops' })).status, 400);
  assert.equal((await request('/api/admin/books/1', { method: 'PUT', headers, body: ' '.repeat(2 * 1024 * 1024 + 1) })).status, 413);
});

test('schema accepts original curriculum, preserves examples, and rejects invalid/duplicate IDs', () => {
  for (const file of ['data/data-textbook1.json', 'data/data-textbook2.json']) assert.deepEqual(validateBook(JSON.parse(readFileSync(file))), JSON.parse(readFileSync(file)));
  assert.throws(() => validateBook({ units: [{ id: 'u', title: 'one', chapters: [] }, { id: 'u', title: 'two', chapters: [] }] }), /unique/);
  assert.throws(() => validateBook({ units: [{ id: "u'", title: 'one', chapters: [] }] }), /IDs/);
  const data = { units: [{ id: 'u', title: '<script>alert(1)</script>', chapters: [{ id: 'c', title: 'Chapter', sections: [{ id: 's', title: 'Section', sentence: '你好', translation: 'Hello', characters: [{ char: '你好', pinyin: 'nǐ hǎo', meaning: 'hello', sentence: '你好', translation: 'Hello' }] }] }] }] };
  assert.deepEqual(validateBook(data), data, 'text remains data, rendered using textContent/value');
  data.units[0].chapters[0].sections[0].characters[0].char = 'hello';
  assert.throws(() => validateBook(data), /Chinese characters/);
});


test('every clean page serves its own HTML, CSS, and script without changing its URL', async t => {
  const { request, login } = await serverFixture(t);
  const { cookie } = await login();
  const headers = { Cookie: cookie };
  for (const [route] of PAGES) {
    const response = await request(route, { headers });
    assert.equal(response.status, 200, route);
    assert.equal(response.headers.get('Location'), null, route);
    assert.match(response.headers.get('Content-Type'), /text\/html/);
    const html = await response.text();
    const prefix = route === '/' ? '' : route;
    assert.ok(html.includes(`href="${prefix}/style.css"`), route);
    assert.ok(html.includes(`src="${prefix}/script.js"`), route);
    for (const [, resource] of html.matchAll(/(?:src|href)="([^"?#]+)(?:[?#][^"]*)?"/g)) {
      if (!resource.startsWith('/')) continue;
      const asset = await request(resource, { headers });
      assert.equal(asset.status, 200, `${route}: ${resource}`);
    }
    for (const extension of ['css', 'js']) {
      const asset = await request(`${prefix}/${extension === 'css' ? 'style.css' : 'script.js'}`, { headers, method: 'HEAD' });
      assert.equal(asset.status, 200);
      assert.match(asset.headers.get('Content-Type'), extension === 'css' ? /text\/css/ : /javascript/);
      assert.equal(await asset.text(), '');
    }
  }
});

test('legacy and index URLs redirect cleanly with query parameters and admin gates intact', async t => {
  const { request, login } = await serverFixture(t);
  const unauthenticated = await request('/maker.html?book=2');
  assert.equal(unauthenticated.status, 303);
  assert.equal(unauthenticated.headers.get('Location'), '/login?next=' + encodeURIComponent('/admin/editor?book=2'));
  const { cookie } = await login();
  const headers = { Cookie: cookie };
  for (const [old, route] of LEGACY_PAGES) {
    const response = await request(old + '?book=2', { headers });
    assert.equal(response.status, 308, old);
    assert.equal(response.headers.get('Location'), route + '?book=2');
  }
  for (const [route] of PAGES) {
    const prefix = route === '/' ? '' : route;
    const response = await request(prefix + '/index.html?book=2', { headers });
    assert.equal(response.status, 308);
    assert.equal(response.headers.get('Location'), route + '?book=2');
    if (prefix) assert.equal((await request(prefix + '/', { headers })).headers.get('Location'), route);
  }
  for (const route of ['/textbook/99', '/public/admin/index.html', '/data/data-textbook1.json', '/server/routes.js', '/textbook/1/missing.js']) assert.equal((await request(route, { headers })).status, 404, route);
  assert.equal((await request('/%ZZ')).status, 400);
});
