
function getParams() {
  const p = new URLSearchParams(window.location.search);
  return { char: p.get('char') || '', pinyin: p.get('pinyin') || '', meaning: p.get('meaning') || '' };
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

const ctx = { root, clearRoot, setProgress, scoreMode: 'Single-word practice' };

function startPractice(item) {
  const items = [item];
  const total = 2; 
  runLearnPhase(ctx, items, 0, total, () => {
    runQuizPhase(ctx, items, 0, { correct: 0, total: 1 }, 1, total, LEARNING_QUIZ_OPTIONS, (tally) => {
      setProgress(total, total, 'Complete');
      showQuizResults(ctx, tally, 'Practice complete', [
        { label: 'Practice again', onClick: () => startPractice(item) },
        { label: 'Back to search', onClick: () => { window.location.href = '/'; } }
      ]);
    });
  });
}

function init() {
  const { char, pinyin, meaning } = getParams();
  if (!/\p{Script=Han}/u.test(char) || !/^[\p{Script=Han}A-Za-z\s]{1,20}$/u.test(char)) {
    breadcrumbEl.textContent = 'Choose a Chinese character or word to practice.';
    root.appendChild(el('p', { text: 'Go back and search for a character to practice.' }));
    return;
  }
  breadcrumbEl.textContent = `Practicing: ${char}${pinyin ? '   ' + pinyin : ''}${meaning ? '   -   ' + meaning : ''}`;
  startPractice({ char, pinyin, meaning });
}

init();
//YC
document.addEventListener('DOMContentLoaded', mountSiteChrome);
