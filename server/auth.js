// Adapted from First-Comment-Bot's failedAttempts / lockoutDuration flow.
// Keep the dot/keypad experience and exponential cooldown; omit all reset paths.
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';

export function createAuth({ pin, stateFile, now = Date.now, sessionMs = 60 * 60 * 1000 }) {
  const salt = randomBytes(16);
  const pinHash = scryptSync(pin, salt, 32);
  const sessions = new Map();
  const initial = { failedAttempts: 0, lockoutUntil: 0, lockoutDuration: 5 * 60 * 1000 };
  let state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : initial;
  if (!['failedAttempts', 'lockoutUntil', 'lockoutDuration'].every(k => Number.isSafeInteger(state[k]) && state[k] >= 0) || state.lockoutDuration < initial.lockoutDuration) {
    throw new Error('Invalid authentication state. Restore a valid security-state.json backup.');
  }
  function persist() {
    writeFileSync(stateFile + '.tmp', JSON.stringify(state), { mode: 0o600 });
    renameSync(stateFile + '.tmp', stateFile);
  }
  const digest = token => createHash('sha256').update(token).digest('hex');
  function getSession(token) {
    if (!token || token.length > 100) return null;
    const key = digest(token);
    const session = sessions.get(key);
    if (session && session.expiresAt > now()) return session;
    sessions.delete(key);
    return null;
  }
  function retryAfter() { return Math.max(0, Math.ceil((state.lockoutUntil - now()) / 1000)); }
  function login(value) {
    if (retryAfter()) return { status: 429, error: 'Too many attempts. Please wait before trying again.', retryAfter: retryAfter() };
    const valid = typeof value === 'string' && /^\d{4}$/.test(value) && timingSafeEqual(scryptSync(value, salt, 32), pinHash);
    if (valid) {
      state = { ...initial };
      persist();
      for (const [key, session] of sessions) if (session.expiresAt <= now()) sessions.delete(key);
      if (sessions.size >= 100) sessions.delete(sessions.keys().next().value);
      const token = randomBytes(32).toString('hex');
      const session = { csrfToken: randomBytes(32).toString('hex'), expiresAt: now() + sessionMs };
      sessions.set(digest(token), session);
      return { status: 200, token, ...session };
    }
    state.failedAttempts++;
    if (state.failedAttempts % 5 === 0) {
      state.lockoutUntil = now() + state.lockoutDuration;
      state.lockoutDuration = Math.min(state.lockoutDuration * 2, 60 * 60 * 1000);
    }
    persist();
    return { status: retryAfter() ? 429 : 401, error: retryAfter() ? 'Too many attempts. Please wait before trying again.' : 'Incorrect PIN. Please try again.', retryAfter: retryAfter(), attemptsRemaining: 5 - state.failedAttempts % 5 };
  }
  return { login, getSession, retryAfter, logout(token) { if (token) sessions.delete(digest(token)); } };
}
