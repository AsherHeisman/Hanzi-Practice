// Browser-only learning history. No scores or answers are sent to the server.
(function () {
  const KEY = 'hanzi-learning.scores.v1';
  const LIMIT = 200;
  function valid(record) {
    return record && typeof record.id === 'string' && typeof record.date === 'string' && Number.isFinite(Date.parse(record.date)) &&
      typeof record.mode === 'string' && typeof record.scope === 'string' &&
      ['total', 'correct', 'completed', 'skipped', 'mistakes'].every(key => Number.isSafeInteger(record[key]) && record[key] >= 0) &&
      record.total > 0 && record.correct <= record.completed && record.completed + record.skipped === record.total;
  }
  function read(storage) {
    try {
      storage ||= globalThis.localStorage;
      const raw = storage.getItem(KEY);
      if (!raw) return { records: [], error: '' };
      const stored = JSON.parse(raw);
      if (stored.version !== 1 || !Array.isArray(stored.sessions) || !stored.sessions.every(valid)) throw new Error();
      return { records: stored.sessions.slice(-LIMIT), error: '' };
    } catch { return { records: [], error: 'Browser history is unavailable. You can still export this session.' }; }
  }
  function points(record) { return record.correct * 100 + (record.completed - record.correct) * 50; }
  function percent(record) { return record.total ? Math.round(points(record) / record.total) : 0; }
  function makeRecord(tally, context = {}) {
    const record = {
      id: `${Date.now()}-${Array.from(crypto.getRandomValues(new Uint8Array(8)), byte => byte.toString(16).padStart(2, '0')).join('')}`,
      date: new Date().toISOString(), mode: context.mode || 'Practice', scope: context.scope || 'Vocabulary practice',
      total: tally.total, correct: tally.correct, completed: tally.completed || 0, skipped: tally.skipped || 0, mistakes: tally.mistakes || 0
    };
    if (!valid(record)) throw new Error('This session is incomplete and cannot be saved.');
    return record;
  }
  function save(record, storage) {
    try {
      storage ||= globalThis.localStorage;
      if (!valid(record)) throw new Error();
      const history = read(storage);
      if (history.error) return { saved: false, error: history.error };
      const records = history.records.filter(item => item.id !== record.id).concat(record).slice(-LIMIT);
      storage.setItem(KEY, JSON.stringify({ version: 1, sessions: records }));
      return { saved: true, error: '' };
    } catch { return { saved: false, error: 'Could not save to this browser. Export this session to keep your score.' }; }
  }
  function clear() {
    try { globalThis.localStorage.removeItem(KEY); return true; } catch { return false; }
  }
  function csv(records) {
    // Prefix spreadsheet formulas in user-editable lesson titles before quoting.
    const cell = value => '"' + String(value).replace(/^[=+@\-\t\r]/, match => "'" + match).replaceAll('"', '""') + '"';
    const rows = [['Date', 'Mode', 'Lesson', 'Words', 'First try', 'Completed', 'Skipped', 'Stroke mistakes', 'Points', 'Score percent']];
    records.forEach(record => rows.push([record.date, record.mode, record.scope, record.total, record.correct, record.completed, record.skipped, record.mistakes, points(record), percent(record)]));
    return '\ufeff' + rows.map(row => row.map(cell).join(',')).join('\r\n');
  }
  function download(records, format = 'json') {
    const content = format === 'csv' ? csv(records) : JSON.stringify({ version: 1, scoring: { firstTry: 100, corrected: 50, skipped: 0 }, sessions: records }, null, 2);
    const url = URL.createObjectURL(new Blob([content], { type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `hanzi-progress-${new Date().toISOString().slice(0, 10)}.${format}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  globalThis.ScoreHistory = { read, save, clear, makeRecord, points, percent, csv, download, LIMIT };
})();
