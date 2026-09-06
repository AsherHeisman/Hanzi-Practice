let adminSession;
async function getAdminSession(redirect = true) {
  const res = await fetch('/api/status');
  if (!res.ok) throw new Error('Could not check your session. Please reload.');
  const session = await res.json();
  if (!session.authenticated) {
    if (redirect) location.replace('/login?next=' + encodeURIComponent(location.pathname + location.search));
    throw new Error('Your session expired. Export your draft, then sign in again in another tab.');
  }
  adminSession = session;
  return session;
}
async function adminFetch(url, options = {}) {
  await getAdminSession(false);
  const res = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': adminSession.csrfToken, ...options.headers } });
  if (res.status === 401) {
    // Leave any unsaved editor draft in place so it can still be exported.
    throw new Error('Your session expired. Export your draft, then sign in again in another tab.');
  }
  return res;
}
document.getElementById('logout').addEventListener('click', async () => {
  if (window.editorDirty && !confirm('Discard your unsaved changes and sign out?')) return;
  try {
    const res = await adminFetch('/api/logout', { method: 'POST' });
    if (!res.ok) throw new Error('Could not sign out. Please try again.');
    window.editorDirty = false;
    location.replace('/login');
  } catch (error) { document.getElementById('admin-message').textContent = error.message; }
});
window.addEventListener('pageshow', async event => { if (event.persisted) await getAdminSession().catch(() => {}); });
