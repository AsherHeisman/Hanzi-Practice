// random quiz geneator

function getParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    book: p.get('book') || 'all',
    unit: p.get('unit') || 'all',
    chapter: p.get('chapter') || 'all',
    count: Math.min(100, Math.max(10, parseInt(p.get('count'), 10) || 20))
  };
}

const root = document.getElementById('app-root');
const breadcrumbEl = document.getElementById('breadcrumb-info');
const progressInner = document.getElementById('progress-bar-inner');
const progressLabel = document.getElementById('progress-label');

function clearRoot() { root.innerHTML = ''; }

function setProgress(current, total, label) {
  const pct = total > 0 ? Math.min(100, Math.max(0, Math.round((current / total) * 100))) : 0;
  progressInner.style.width = pct + '%';
  progressLabel.textContent = label ? `${label} (${pct}%)` : `${pct}%`;
}

const ctx = { root, clearRoot, setProgress, scoreMode: 'Pop quiz' };

function startRandomQuiz(pool, count) {
  const items = cyclicSample(pool, count);
  const total = items.length;
  runQuizPhase(ctx, items, 0, { correct: 0, total: items.length }, 0, total, POP_QUIZ_WRITER_OPTIONS, (tally) => {
    setProgress(total, total, 'Complete');
    showQuizResults(ctx, tally, 'Pop quiz complete!', [
      { label: 'New random set', onClick: () => startRandomQuiz(pool, count) },
      { label: 'Back to Pop Quiz', onClick: () => { window.location.href = '/quiz'; } }
    ]);
  });
}

async function init() {
  try {
    const { book, unit, chapter, count } = getParams();
    let pool = [];
    let scopeLabel = 'All textbooks';

    if (book === 'all') {
      for (const b of BOOKS) {
        const data = await loadBook(b.file);
        pool = pool.concat(flattenCharacters(data));
      }
    } else {
      const bookObj = BOOKS.find(b => b.id === book);
      if (!bookObj) throw new Error('Unknown textbook: ' + book);
      const data = await loadBook(bookObj.file);
      const scope = { unitId: unit === 'all' ? null : unit, chapterId: chapter === 'all' ? null : chapter };
      pool = flattenCharacters(data, scope);

      const unitObj = data.units.find(u => u.id === unit);
      const chapterObj = unitObj ? unitObj.chapters.find(c => c.id === chapter) : null;
      scopeLabel = chapterObj
        ? `${bookObj.label} - ${chapterObj.title}`
        : (unitObj ? `${bookObj.label} - ${unitObj.title}` : bookObj.label);
    }

    breadcrumbEl.textContent = `Pop Quiz - ${scopeLabel} - ${count} random characters`;

    if (pool.length === 0) {
      root.appendChild(el('p', { text: 'No vocabulary found. Choose a different quiz scope.' }));
      return;
    }

    startRandomQuiz(pool, count);
  } catch (err) {
    breadcrumbEl.textContent = 'Could not start the quiz: ' + err.message;
  }
}

init();
//YC
document.addEventListener('DOMContentLoaded', mountSiteChrome);
