import path from 'node:path';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const PUBLIC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
export const PAGES = new Map([
  ['/', ''], ['/textbook/1', 'textbook/1'], ['/textbook/2', 'textbook/2'],
  ['/learn', 'learn'], ['/practice', 'practice'], ['/quiz', 'quiz'],
  ['/quiz/session', 'quiz/session'], ['/login', 'login'], ['/admin', 'admin'],
  ['/admin/editor', 'admin/editor'], ['/progress', 'progress'],
  ['/feedback', 'feedback'], ['/about', 'about']
]);
export const LEGACY_PAGES = new Map([
  ['/index.html', '/'], ['/textbook1.html', '/textbook/1'], ['/textbook2.html', '/textbook/2'],
  ['/learn.html', '/learn'], ['/practice.html', '/practice'], ['/pop-quiz.html', '/quiz'],
  ['/random-quiz.html', '/quiz/session'], ['/login.html', '/login'], ['/admin1.html', '/admin'],
  ['/maker.html', '/admin/editor'], ['/testmaker.html', '/admin/editor'],
  ['/progress.html', '/progress'], ['/suggestion.html', '/feedback'], ['/terms.html', '/about']
]);
function inventory(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith('.')) return [];
    const relative = prefix + entry.name;
    return entry.isDirectory() ? inventory(path.join(directory, entry.name), relative + '/') :
      entry.isFile() && /\.(?:html|css|js|svg|ttf|txt)$/.test(entry.name) ? [relative] : [];
  });
}
// Only regular files present inside public/ can be served. Never follow symlinks.
const files = new Set(inventory(PUBLIC_ROOT));
export function resolveStatic(pathname) {
  let canonical = LEGACY_PAGES.get(pathname);
  if (!canonical && pathname.endsWith('/index.html')) canonical = pathname.slice(0, -11) || '/';
  if (!canonical && pathname !== '/' && pathname.endsWith('/')) canonical = pathname.slice(0, -1);
  if (!PAGES.has(canonical)) canonical = PAGES.has(pathname) ? pathname : null;
  if (canonical) {
    const directory = PAGES.get(canonical);
    return {
      file: (directory ? directory + '/' : '') + 'index.html',
      page: canonical,
      protected: canonical === '/admin' || canonical.startsWith('/admin/'),
      redirect: pathname === canonical ? null : canonical
    };
  }
  const file = pathname.slice(1);
  if (!files.has(file) || file.endsWith('.html')) return null;
  return { file, protected: file.startsWith('admin/'), page: null, redirect: null };
}
