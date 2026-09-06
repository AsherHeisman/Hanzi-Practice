// Dot display, numeric keypad, auto-submit and shake feedback adapted from
// First-Comment-Bot/public/js/main.js. PIN resets intentionally omitted.
const pinInput = document.getElementById('pin-input');
const pinDots = document.getElementById('pin-dots');
const errorMsg = document.getElementById('pin-error-msg');
const keypad = document.getElementById('pin-keypad');
let currentPin = '';
let busy = true;
let lockedUntil = 0;
let lastStatusCheck = 0;
const requested = new URLSearchParams(location.search).get('next');
let destination = '/admin';
try {
  const next = new URL(requested || '/admin', location.origin);
  if (next.origin === location.origin && ['/admin', '/admin/editor'].includes(next.pathname)) destination = next.pathname + next.search;
} catch { /* Invalid return URLs fall back to the admin overview. */ }
function updatePinDots() {
  pinInput.value = currentPin;
  [...pinDots.children].forEach((dot, i) => dot.classList.toggle('filled', i < currentPin.length));
}
function updateControls() {
  const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
  pinInput.disabled = busy || remaining > 0;
  keypad.querySelectorAll('button').forEach(button => button.disabled = busy || remaining > 0);
  if (remaining) { errorMsg.classList.add('error-state'); errorMsg.textContent = `Too many attempts. Try again in ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}.`; }
  else if (lockedUntil) { lockedUntil = 0; errorMsg.classList.remove('error-state'); errorMsg.textContent = 'You can try your PIN again.'; pinInput.focus(); }
}
function triggerPinError(message) {
  errorMsg.classList.add('error-state');
  errorMsg.textContent = message;
  pinDots.classList.remove('shake');
  void pinDots.offsetWidth;
  pinDots.classList.add('shake');
}
function pinPress(digit) {
  if (busy || lockedUntil > Date.now() || currentPin.length >= 4) return;
  currentPin += digit;
  errorMsg.classList.remove('error-state'); errorMsg.textContent = '';
  updatePinDots();
  if (currentPin.length === 4) attemptLogin();
}
function pinBackspace() {
  if (busy || lockedUntil > Date.now()) return;
  currentPin = currentPin.slice(0, -1);
  updatePinDots();
}
async function attemptLogin() {
  if (busy) return;
  busy = true;
  updateControls();
  errorMsg.classList.remove('error-state'); errorMsg.textContent = 'Unlocking…';
  try {
    const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: currentPin }) });
    const data = await res.json();
    if (res.ok) { location.replace(destination); return; }
    if (data.retryAfter) lockedUntil = Date.now() + data.retryAfter * 1000;
    triggerPinError(data.error + (data.attemptsRemaining && !data.retryAfter ? ` ${data.attemptsRemaining} attempts left.` : ''));
  } catch { triggerPinError('Could not reach the server. Please try again.'); }
  finally { currentPin = ''; busy = false; updatePinDots(); updateControls(); }
}
for (const key of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'delete']) {
  if (!key) { keypad.appendChild(el('span', { class: 'key empty', 'aria-hidden': 'true' })); continue; }
  const button = el('button', { type: 'button', class: 'key', 'aria-label': key === 'delete' ? 'Delete last digit' : key });
  if (key === 'delete') button.appendChild(icon('backspace')); else button.textContent = key;
  button.addEventListener('click', () => key === 'delete' ? pinBackspace() : pinPress(key));
  keypad.appendChild(button);
}
pinInput.addEventListener('input', () => {
  if (busy || lockedUntil > Date.now()) return;
  currentPin = pinInput.value.replace(/\D/g, '').slice(0, 4);
  updatePinDots();
  errorMsg.classList.remove('error-state'); errorMsg.textContent = '';
  if (currentPin.length === 4) attemptLogin();
});
document.addEventListener('keydown', e => {
  if (e.target === pinInput || e.target.closest('.site-search') || e.ctrlKey || e.metaKey || e.altKey) return;
  if (/^\d$/.test(e.key)) { e.preventDefault(); pinPress(e.key); }
  if (e.key === 'Backspace') { e.preventDefault(); pinBackspace(); }
});
async function checkStatus() {
  lastStatusCheck = Date.now();
  try {
    const res = await fetch('/api/status');
    if (!res.ok) throw new Error();
    const data = await res.json();
    if (data.authenticated) { location.replace(destination); return; }
    if (data.retryAfter) lockedUntil = Date.now() + data.retryAfter * 1000;
    if (busy) { errorMsg.classList.remove('error-state'); errorMsg.textContent = ''; }
  } catch { triggerPinError('Could not reach the server. Please try again.'); }
  busy = false;
  updateControls();
}
setInterval(() => { updateControls(); if (!document.hidden && !busy && Date.now() - lastStatusCheck > 15000) checkStatus(); }, 1000);
checkStatus();

document.addEventListener('DOMContentLoaded', mountSiteChrome);
