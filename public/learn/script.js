// main learn page

function getParams() {
  const p = new URLSearchParams(window.location.search);
  return { book: p.get('book'), unit: p.get('unit'), chapter: p.get('chapter'), section: p.get('section') };
}

async function loadSection() {
  const { book: bookId, unit: unitId, chapter: chapterId, section: sectionId } = getParams();
  const book = BOOKS.find(b => b.id === bookId);
  if (!book) throw new Error('Unknown textbook: ' + bookId);
  const data = await loadBook(book.file);
  const unit = data.units.find(u => u.id === unitId);
  if (!unit) throw new Error('Unit not found: ' + unitId);
  const chapter = unit.chapters.find(c => c.id === chapterId);
  if (!chapter) throw new Error('Chapter not found: ' + chapterId);
  const section = chapter.sections.find(s => s.id === sectionId);
  if (!section) throw new Error('Section not found: ' + sectionId);
  return { book, unit, chapter, section };
}

const root = document.getElementById('app-root');
const breadcrumbEl = document.getElementById('breadcrumb-info');
const backLinkEl = document.getElementById('back-link');
const modeSelectEl = document.getElementById('mode-select');
const progressInner = document.getElementById('progress-bar-inner');
const progressLabel = document.getElementById('progress-label');

function clearRoot() { root.innerHTML = ''; }

function setProgress(current, total, label) {
  const pct = total > 0 ? Math.min(100, Math.max(0, Math.round((current / total) * 100))) : 0;
  progressInner.style.width = pct + '%';
  progressLabel.textContent = label ? `${label} (${pct}%)` : `${pct}%`;
}

function resetProgress() {
  progressInner.style.width = '0%';
  progressLabel.textContent = '';
}

const ctx = { root, clearRoot, setProgress };

function startCharacterLearning(section) {
  ctx.scoreMode = 'Guided learning';
  const items = section.characters;
  const total = items.length * 2; 
  runLearnPhase(ctx, items, 0, total, () => {
    runQuizPhase(ctx, items, 0, { correct: 0, total: items.length }, items.length, total, LEARNING_QUIZ_OPTIONS, (tally) => {
      setProgress(total, total, 'Complete');
      showQuizResults(ctx, tally, 'Character learning complete', [
        { label: 'Retry', onClick: () => startCharacterLearning(section) },
        { label: 'Back to mode select', onClick: showModeSelect }
      ]);
    });
  });
}

function startPopQuiz(section) {
  ctx.scoreMode = 'Section quiz';
  const items = section.characters;
  const total = items.length;
  runQuizPhase(ctx, items, 0, { correct: 0, total: items.length }, 0, total, POP_QUIZ_WRITER_OPTIONS, (tally) => {
    setProgress(total, total, 'Complete');
    showQuizResults(ctx, tally, 'Pop quiz complete', [
      { label: 'Retry', onClick: () => startPopQuiz(section) },
      { label: 'Back to mode select', onClick: showModeSelect }
    ]);
  });
}

function showModeSelect() {
  clearRoot();
  resetProgress();
  modeSelectEl.classList.remove('hidden');
}

async function init() {
  try {
    const { book, unit, chapter, section } = await loadSection();
    if (!section.characters.length) throw new Error('This section has no vocabulary yet. Choose another section.');
    const sentenceSuffix = section.sentence ? ` - ${section.sentence}` : '';
    breadcrumbEl.textContent = `${book.label} / ${unit.title} / ${chapter.title} / ${section.title}${sentenceSuffix}`;
    if (backLinkEl) {
      backLinkEl.href = '/textbook/' + book.id;
      backLinkEl.replaceChildren(icon('back'), el('span', { class: 'back-label', text: 'Back to ' + book.label }));
    }

    document.getElementById('mode-character').addEventListener('click', () => {
      modeSelectEl.classList.add('hidden');
      startCharacterLearning(section);
    });
    document.getElementById('mode-popquiz').addEventListener('click', () => {
      modeSelectEl.classList.add('hidden');
      startPopQuiz(section);
    });

    showModeSelect();
  } catch (err) {
    breadcrumbEl.textContent = 'Error: ' + err.message;
    root.appendChild(el('p', { text: '' }));
  }
}

init();
//YC
document.addEventListener('DOMContentLoaded', mountSiteChrome);
