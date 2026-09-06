function renderSection(unit, chapter, section, bookId) {
  const row = el('div', { class: 'section-row' });
  const count = section.characters.length;
  row.appendChild(el('div', {}, [el('span', { text: section.title }), el('small', { text: `${count} words${section.sentence ? ' · ' + section.sentence : ''}` })]));
  const params = new URLSearchParams({ book: bookId, unit: unit.id, chapter: chapter.id, section: section.id });
  if (count) row.appendChild(el('a', { class: 'button secondary', href: '/learn?' + params, text: 'Study', 'aria-label': `Study ${section.title}` }, [icon('arrow')]));
  else row.appendChild(el('small', { text: 'No words yet' }));
  return row;
}
function renderUnit(unit, bookId, index) {
  const wrap = el('details', { class: 'unit' });
  wrap.open = index === 0;
  wrap.appendChild(el('summary', { text: unit.title }, [el('small', { text: `${unit.chapters.length} chapters` })]));
  unit.chapters.forEach(chapter => {
    const group = el('div', { class: 'chapter' }, [el('h3', { text: chapter.title })]);
    chapter.sections.forEach(section => group.appendChild(renderSection(unit, chapter, section, bookId)));
    if (!chapter.sections.length) group.appendChild(el('p', { class: 'muted', text: 'Lessons are being prepared.' }));
    wrap.appendChild(group);
  });
  return wrap;
}
async function initBookPage() {
  const book = BOOKS.find(b => b.id === document.body.dataset.book);
  const container = document.getElementById('units');
  try {
    const data = await loadBook(book.file);
    const stats = bookStats(data);
    document.getElementById('book-summary').textContent = `${stats.units} units · ${stats.chapters} chapters · ${stats.words} vocabulary entries`;
    data.units.forEach((unit, index) => container.appendChild(renderUnit(unit, book.id, index)));
    if (!data.units.length) container.appendChild(el('div', { class: 'panel empty-state', text: 'This textbook is being prepared. Try the other textbook in the meantime.' }));
  } catch { container.appendChild(el('p', { class: 'notice error-message', text: 'Could not load this textbook. Please reload to try again.' })); }
}

