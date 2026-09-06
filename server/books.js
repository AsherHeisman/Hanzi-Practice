import { createHash } from 'node:crypto';

export function revision(data) { return '"' + createHash('sha256').update(JSON.stringify(data)).digest('hex') + '"'; }

export { validateBook } from '../public/admin/shared/validation.js';
