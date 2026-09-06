async function init() {
  const bookSelect = document.getElementById('quiz-book-select');
  const unitSelect = document.getElementById('quiz-unit-select');
  const chapterSelect = document.getElementById('quiz-chapter-select');
  const countInput = document.getElementById('quiz-count');
  const countValue = document.getElementById('quiz-count-value');
  const note = document.getElementById('quiz-config-note');
  const startBtn = document.getElementById('start-random-quiz');
  bookSelect.appendChild(el('option', { value: 'all', text: 'All textbooks' }));
  BOOKS.forEach(book => bookSelect.appendChild(el('option', { value: book.id, text: book.label })));
  let books;
  let busy = false;
  function reset(select, label, items = []) {
    select.replaceChildren(el('option', { value: 'all', text: label }));
    items.forEach(item => select.appendChild(el('option', { value: item.id, text: item.title })));
  }
  function refresh(changed = 'book') {
    const data = books.find(entry => entry.book.id === bookSelect.value)?.data;
    if (changed === 'book') reset(unitSelect, 'All units', data?.units);
    if (changed !== 'chapter') reset(chapterSelect, 'All chapters', data?.units.find(unit => unit.id === unitSelect.value)?.chapters);
    unitSelect.disabled = !data;
    chapterSelect.disabled = !data || unitSelect.value === 'all';
    const pool = data ? flattenCharacters(data, { unitId: unitSelect.value === 'all' ? null : unitSelect.value, chapterId: chapterSelect.value === 'all' ? null : chapterSelect.value }) : books.flatMap(entry => flattenCharacters(entry.data));
    startBtn.disabled = !pool.length;
    note.textContent = pool.length ? `${pool.length} vocabulary entries available. Smaller pools repeat to fill your quiz.` : 'No vocabulary in this selection yet. Try a different chapter.';
  }
  async function load() {
    busy = true;
    startBtn.disabled = true;
    bookSelect.disabled = true;
    unitSelect.disabled = true;
    chapterSelect.disabled = true;
    note.textContent = 'Loading vocabulary…';
    try {
      books = await loadAllBooks();
      refresh();
      bookSelect.disabled = false;
    } catch {
      note.replaceChildren(el('span', { text: 'Could not load vocabulary. ' }));
      const retry = el('button', { class: 'secondary', text: 'Try again' });
      retry.addEventListener('click', load);
      note.appendChild(retry);
    } finally { busy = false; }
  }
  bookSelect.addEventListener('change', () => refresh('book'));
  unitSelect.addEventListener('change', () => refresh('unit'));
  chapterSelect.addEventListener('change', () => refresh('chapter'));
  countInput.addEventListener('input', () => countValue.textContent = countInput.value);
  startBtn.addEventListener('click', () => {
    if (busy || startBtn.disabled) return;
    const params = new URLSearchParams({ book: bookSelect.value, unit: unitSelect.value, chapter: chapterSelect.value, count: countInput.value });
    location.href = '/quiz/session?' + params;
  });
  await load();
}
document.addEventListener('DOMContentLoaded', init);

document.addEventListener('DOMContentLoaded', mountSiteChrome);
