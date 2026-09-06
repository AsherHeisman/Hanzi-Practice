const message = document.getElementById('history-message');
let records = [];
function renderHistory() {
  let history;
  try { history = ScoreHistory.read(); } catch { history = { records: [], error: 'Browser storage is unavailable.' }; }
  records = history.records;
  message.textContent = history.error;
  const stats = document.getElementById('history-stats');
  stats.replaceChildren();
  const totals = records.reduce((sum, record) => ({ points: sum.points + ScoreHistory.points(record), words: sum.words + record.total, correct: sum.correct + record.correct }), { points: 0, words: 0, correct: 0 });
  for (const [value, label] of [[records.length, 'Completed sessions'], [totals.points.toLocaleString(), 'Total points'], [totals.words, 'Words practiced'], [totals.words ? Math.round(totals.correct / totals.words * 100) + '%' : '-', 'Words correct first try']]) stats.appendChild(el('div', { class: 'stat' }, [el('strong', { text: value }), el('span', { text: label })]));
  const list = document.getElementById('history-list');
  list.replaceChildren();
  if (!records.length) list.appendChild(el('div', { class: 'panel empty-state' }, [el('h2', { text: 'Your next session starts your story.' }), el('p', { text: 'Finish a lesson or quiz to save your first score.' }), el('a', { class: 'button secondary', href: '/textbook/1', text: 'Choose a lesson' })]));
  [...records].reverse().forEach(record => {
    list.appendChild(el('article', { class: 'history-row' }, [
      el('div', {}, [el('h3', { text: record.mode }), el('p', { text: record.scope }), el('p', { text: `${new Date(record.date).toLocaleString()} · ${record.correct}/${record.total} first try · ${record.completed - record.correct} with corrections · ${record.skipped} skipped` })]),
      el('div', {}, [el('strong', { class: 'history-score', text: `${ScoreHistory.percent(record)}%` }), el('p', { text: `${ScoreHistory.points(record)} pts` })])
    ]));
  });
  document.getElementById('export-json').disabled = !records.length;
  document.getElementById('export-csv').disabled = !records.length;
  document.getElementById('clear-history').disabled = !records.length && !history.error;
}
for (const format of ['json', 'csv']) {
  const button = document.getElementById(`export-${format}`);
  button.appendChild(icon('download'));
  button.addEventListener('click', () => ScoreHistory.download(records, format));
}
document.getElementById('clear-history').addEventListener('click', () => {
  if (!confirm('Clear all saved practice scores from this browser? Export a copy first if you want to keep them.')) return;
  if (ScoreHistory.clear()) renderHistory(); else message.textContent = 'Could not clear history. Check your browser storage settings.';
});
window.addEventListener('storage', renderHistory);
window.addEventListener('pageshow', renderHistory);
renderHistory();

document.addEventListener('DOMContentLoaded', mountSiteChrome);
