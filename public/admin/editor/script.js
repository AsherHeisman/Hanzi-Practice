import { validateBook } from '/admin/shared/validation.js';
const select = document.getElementById('editor-book');
const tree = document.getElementById('editor-tree');
const form = document.getElementById('editor-form');
const message = document.getElementById('admin-message');
let data = null;
let etag = '';
let bookId = new URLSearchParams(location.search).get('book') === '2' ? '2' : '1';
let selected = null;
let busy = false;
window.editorDirty = false;
select.value = bookId;
const bookLabel = id => `Go Far with Chinese ${id}`;
for (const option of select.options) option.textContent = bookLabel(option.value);
const uid = prefix => prefix + Array.from(crypto.getRandomValues(new Uint8Array(8)), byte => byte.toString(16).padStart(2, '0')).join('');
function announce(text, error = false) { message.textContent = text; message.classList.toggle('error-message', error); }
function setBusy(value) {
  busy = value;
  document.querySelectorAll('.editor-toolbar button, .editor-toolbar select, .editor-tree button, .editor-form button, .editor-form input, .editor-form textarea').forEach(node => node.disabled = value);
  document.getElementById('save-book').textContent = value ? 'Please wait…' : 'Save changes';
}
function markDirty() { window.editorDirty = true; announce('Unsaved changes. Save when you’re ready to update this textbook.'); updateSummary(); }
function updateSummary() {
  if (!data) return;
  const stats = bookStats(data);
  document.getElementById('editor-summary').textContent = `${stats.units} units · ${stats.chapters} chapters · ${stats.sections} sections · ${stats.words} vocabulary entries`;
}
function action(text, handler, className = 'secondary') {
  const button = el('button', { type: 'button', class: className, text });
  button.addEventListener('click', handler);
  return button;
}
function field(label, object, key, { multiline = false, max = 250 } = {}) {
  const input = el(multiline ? 'textarea' : 'input', { ...(multiline ? { rows: '2' } : { type: 'text' }), maxlength: String(max) });
  input.value = object[key] || '';
  input.addEventListener('input', () => { object[key] = input.value; markDirty(); });
  if (key === 'title') input.addEventListener('change', renderTree);
  return el('label', { text: label }, [input]);
}
function findSelected() {
  for (const unit of data.units) {
    if (unit.id === selected) return { unit, item: unit, type: 'unit' };
    for (const chapter of unit.chapters) {
      if (chapter.id === selected) return { unit, chapter, item: chapter, type: 'chapter' };
      for (const section of chapter.sections) if (section.id === selected) return { unit, chapter, section, item: section, type: 'section' };
    }
  }
  return null;
}
function choose(id) { selected = id; renderTree(); renderForm(); }
function addUnit() {
  const unit = { id: uid('u'), title: 'New unit', chapters: [] };
  data.units.push(unit); markDirty(); choose(unit.id);
}
function addChapter(unit) {
  const chapter = { id: uid('c'), title: 'New chapter', sections: [] };
  unit.chapters.push(chapter); markDirty(); choose(chapter.id);
}
function addSection(chapter) {
  const section = { id: uid('s'), title: 'New section', characters: [] };
  chapter.sections.push(section); markDirty(); choose(section.id);
}
function renderTree() {
  const openIds = new Set([...tree.querySelectorAll('details[open]')].map(node => node.dataset.id));
  tree.replaceChildren();
  if (!data.units.length) { tree.appendChild(el('p', { class: 'empty-state', text: 'Add a unit to begin.' })); return; }
  const context = findSelected();
  for (const unit of data.units) {
    const details = el('details', { class: 'tree-unit', 'data-id': unit.id });
    details.open = openIds.has(unit.id) || context?.unit === unit;
    details.appendChild(el('summary', { text: unit.title }));
    const editUnit = action('Edit unit', () => choose(unit.id), 'tree-link');
    if (unit.id === selected) editUnit.classList.add('active');
    details.appendChild(editUnit);
    for (const chapter of unit.chapters) {
      const group = el('div', { class: 'tree-chapter' });
      const chapterButton = action(chapter.title, () => choose(chapter.id), 'tree-link');
      if (selected === chapter.id) chapterButton.classList.add('active');
      group.appendChild(chapterButton);
      for (const section of chapter.sections) {
        const button = action(section.title, () => choose(section.id), 'tree-link');
        if (selected === section.id) { button.classList.add('active'); button.setAttribute('aria-current', 'true'); }
        group.appendChild(button);
      }
      details.appendChild(group);
    }
    tree.appendChild(details);
  }
}
function deleteSelected(context) {
  if (!confirm(`Remove “${context.item.title}” and everything inside it from this draft?`)) return;
  const list = context.type === 'unit' ? data.units : context.type === 'chapter' ? context.unit.chapters : context.chapter.sections;
  list.splice(list.indexOf(context.item), 1);
  markDirty();
  choose(context.type === 'unit' ? data.units[0]?.id : context.type === 'chapter' ? context.unit.id : context.chapter.id);
}
function renderForm() {
  form.replaceChildren();
  const context = findSelected();
  if (!context) {
    form.appendChild(el('div', { class: 'empty-state' }, [el('h2', { text: 'A fresh page for your curriculum' }), el('p', { text: 'Select a lesson, add a unit, or import a textbook JSON file.' }), action('+ Add unit', addUnit)]));
    return;
  }
  const { item, type, unit, chapter, section } = context;
  form.appendChild(field(`${type[0].toUpperCase() + type.slice(1)} title`, item, 'title'));
  if (type === 'unit' || type === 'chapter') {
    const children = type === 'unit' ? unit.chapters : chapter.sections;
    form.appendChild(el('p', { class: 'muted', text: type === 'unit' ? 'Group related lessons into chapters.' : 'Each section becomes a learning session.' }));
    children.forEach(child => form.appendChild(el('div', { class: 'section-row' }, [el('span', { text: child.title }), action('Edit', () => choose(child.id))])));
    form.appendChild(el('div', { class: 'controls' }, [action(type === 'unit' ? '+ Add chapter' : '+ Add section', () => type === 'unit' ? addChapter(unit) : addSection(chapter)), action(`Remove ${type}`, () => deleteSelected(context), 'danger')]));
    return;
  }
  form.appendChild(el('div', { class: 'field-row' }, [field('Example sentence (optional)', section, 'sentence', { multiline: true, max: 2000 }), field('Translation (optional)', section, 'translation', { multiline: true, max: 2000 })]));
  form.appendChild(el('div', { class: 'editor-section-head' }, [el('h2', { text: 'Vocabulary' }), action('+ Add word', () => { section.characters.push({ char: '', pinyin: '', meaning: '' }); markDirty(); renderForm(); form.querySelector('.word-fields:last-of-type input')?.focus(); })]));
  if (!section.characters.length) form.appendChild(el('p', { class: 'empty-state', text: 'No words yet. Add your first character or word.' }));
  section.characters.forEach((word, index) => {
    const remove = action('', () => {
      if (word.char && !confirm(`Remove “${word.char}” from this section?`)) return;
      section.characters.splice(index, 1); markDirty(); renderForm();
    }, 'danger');
    remove.appendChild(icon('close'));
    remove.setAttribute('aria-label', `Remove word ${index + 1}${word.char ? ', ' + word.char : ''}`);
    form.appendChild(el('div', { class: 'word-fields' }, [field('Character / word', word, 'char', { max: 20 }), field('Pinyin', word, 'pinyin', { max: 150 }), field('Meaning', word, 'meaning', { max: 1000 }), remove]));
    // Preserve and expose example fields present in older/imported vocabulary.
    if ('sentence' in word || 'translation' in word) form.appendChild(el('div', { class: 'field-row' }, [field('Word example', word, 'sentence', { multiline: true, max: 2000 }), field('Word translation', word, 'translation', { multiline: true, max: 2000 })]));
  });
  form.appendChild(el('div', { class: 'controls' }, [action('Remove section', () => deleteSelected(context), 'danger')]));
}
async function load() {
  setBusy(true);
  try {
    await getAdminSession();
    const res = await adminFetch(`/api/admin/books/${bookId}`);
    if (!res.ok) throw new Error('Could not load this textbook. Please reload.');
    data = await res.json();
    etag = res.headers.get('ETag');
    selected = data.units[0]?.chapters[0]?.sections[0]?.id || data.units[0]?.id;
    window.editorDirty = false;
    renderTree(); renderForm(); updateSummary();
    announce('Changes stay in your draft until you save. Export a copy any time.');
  } catch (error) { announce(error.message, true); }
  finally { setBusy(false); if (!data) document.querySelectorAll('.editor-toolbar button, #add-unit').forEach(button => button.disabled = true); }
}
select.addEventListener('change', async () => {
  if (window.editorDirty && !confirm('Discard your unsaved changes and switch textbooks?')) { select.value = bookId; return; }
  bookId = select.value;
  data = null;
  tree.replaceChildren(); form.replaceChildren();
  await load();
});
document.getElementById('add-unit').addEventListener('click', addUnit);
document.getElementById('new-book').addEventListener('click', () => {
  if (!confirm(`Start a blank draft for ${bookLabel(bookId)}? The published textbook is only replaced when you save.`)) return;
  data = { units: [] }; selected = null; markDirty(); renderTree(); renderForm();
});
document.getElementById('export-button').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = el('a', { href: url, download: `data-textbook${bookId}.json` });
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
const importFile = document.getElementById('import-file');
document.getElementById('import-button').addEventListener('click', () => importFile.click());
importFile.addEventListener('change', async () => {
  const file = importFile.files[0];
  if (!file) return;
  setBusy(true);
  try {
    if (file.size > 2 * 1024 * 1024) throw new Error('Choose a JSON file smaller than 2 MB.');
    const imported = validateBook(JSON.parse(await file.text()));
  if (!confirm(`Replace the current draft for ${bookLabel(bookId)} with “${file.name}”? Save changes to publish it.`)) return;
    data = imported; selected = data.units[0]?.id; markDirty(); renderTree(); renderForm();
    announce('Textbook imported into your draft. Review it, then save changes.');
  } catch (error) { announce(`Import failed: ${error.message}`, true); }
  finally { importFile.value = ''; setBusy(false); }
});
document.getElementById('save-book').addEventListener('click', async () => {
  if (busy) return;
  setBusy(true);
  try {
    const clean = validateBook(data);
    const res = await adminFetch(`/api/admin/books/${bookId}`, { method: 'PUT', headers: { 'If-Match': etag }, body: JSON.stringify(clean) });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Could not save changes.');
    data = clean; etag = res.headers.get('ETag'); window.editorDirty = false;
    renderTree(); renderForm(); updateSummary();
    announce('Saved. Your updated textbook is now available to learners.');
  } catch (error) { announce(error.message, true); }
  finally { setBusy(false); }
});
window.addEventListener('beforeunload', event => { if (window.editorDirty) { event.preventDefault(); event.returnValue = ''; } });
load();

document.addEventListener('DOMContentLoaded', mountSiteChrome);
