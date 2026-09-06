import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { validateBook } from '../public/admin/shared/validation.js';
import { PAGES, PUBLIC_ROOT, resolveStatic } from '../server/routes.js';
function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
}
for (const file of [...walk('public'), ...walk('server'), ...walk('scripts')].filter(file => file.endsWith('.js'))) execFileSync(process.execPath, ['--check', file]);
for (const [route, directory] of PAGES) {
  const pageDirectory = path.join(PUBLIC_ROOT, directory);
  for (const file of ['index.html', 'style.css', 'script.js']) if (!existsSync(path.join(pageDirectory, file))) throw new Error(`${route}: missing ${file}`);
  const html = readFileSync(path.join(pageDirectory, 'index.html'), 'utf8');
  if (!html.includes('name="viewport"')) throw new Error(`${route}: missing viewport`);
  if (/\son(?:click|input|change|load)=|\sstyle=|<style[\s>]/i.test(html)) throw new Error(`${route}: inline code or styling`);
  const prefix = route === '/' ? '' : route;
  if (!html.includes(`href="${prefix}/style.css"`) || !html.includes(`src="${prefix}/script.js"`)) throw new Error(`${route}: must reference its own stylesheet and script`);
  for (const [, resource] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (/^(?:https?:|data:|#)/.test(resource)) continue;
    const pathname = new URL(resource, 'http://localhost' + route).pathname;
    if (!resolveStatic(pathname)) throw new Error(`${route}: missing resource ${resource}`);
    if (/\.html(?:[?#]|$)/.test(resource)) throw new Error(`${route}: old HTML navigation ${resource}`);
  }
}
for (const file of walk('public').filter(file => file.endsWith('.css'))) {
  for (const [, resource] of readFileSync(file, 'utf8').matchAll(/url\(['"]?([^'"\)]+)['"]?\)/g)) {
    if (!resolveStatic(resource)) throw new Error(`${file}: missing CSS resource ${resource}`);
  }
}
for (const file of ['data/data-textbook1.json', 'data/data-textbook2.json']) validateBook(JSON.parse(readFileSync(file, 'utf8')));
console.log('JavaScript syntax, page folders, clean links, CSS assets, and textbook schema checks passed.');
