import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';

function fixture(storage) {
  const data = new Map();
  const localStorage = storage || { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
  const context = vm.createContext({ crypto: webcrypto, localStorage });
  vm.runInContext(readFileSync('public/shared/scores.js', 'utf8'), context);
  return { scores: context.ScoreHistory, context, localStorage };
}
function record(scores, changes = {}) {
  return { ...scores.makeRecord({ correct: 1, completed: 2, skipped: 1, total: 3, mistakes: 2 }, { mode: 'Pop quiz', scope: 'Textbook 1' }), ...changes };
}

test('scoring gives first-try, corrected, and skipped words distinct credit', () => {
  const { scores } = fixture();
  const result = record(scores);
  assert.equal(scores.points(result), 150);
  assert.equal(scores.percent(result), 50);
  assert.throws(() => scores.makeRecord({ correct: 1, total: 4, completed: 1, skipped: 1 }), /incomplete/);
  assert.equal(scores.points(record(scores, { correct: 3, completed: 3, skipped: 0 })), 300);
});

test('history survives a reload, deduplicates sessions, and retains the latest 200', () => {
  const { scores, localStorage } = fixture();
  const first = record(scores, { id: 'first' });
  assert.equal(scores.save(first).saved, true);
  scores.save(first);
  assert.equal(scores.read().records.length, 1);
  const reload = fixture(localStorage).scores;
  assert.equal(reload.read().records[0].id, 'first');
  for (let i = 0; i < 205; i++) reload.save(record(reload, { id: String(i) }));
  assert.equal(reload.read().records.length, 200);
  assert.equal(reload.read().records[0].id, '5');
  assert.equal(reload.read().records.at(-1).id, '204');
});

test('blocked, full, or malformed storage reports failure without losing exportable results', () => {
  const blocked = fixture({ getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } }).scores;
  const result = record(blocked);
  assert.equal(blocked.save(result).saved, false);
  assert.ok(blocked.read().error);
  assert.match(blocked.csv([result]), /Textbook 1/);
  const full = fixture({ getItem() { return null; }, setItem() { throw new Error('quota'); } }).scores;
  assert.equal(full.save(record(full)).saved, false);
  let overwritten = false;
  const malformed = fixture({ getItem() { return '{oops'; }, setItem() { overwritten = true; } }).scores;
  assert.equal(malformed.save(record(malformed)).saved, false);
  assert.equal(overwritten, false);
  const { scores, context } = fixture();
  Object.defineProperty(context, 'localStorage', { get() { throw new Error('blocked getter'); } });
  assert.ok(scores.read().error);
});

test('CSV preserves Chinese, escapes quotes, and prevents spreadsheet formulas', () => {
  const { scores } = fixture();
  const csv = scores.csv([record(scores, { scope: '=HYPERLINK("你好")' })]);
  assert.ok(csv.startsWith('\ufeff'));
  assert.ok(csv.includes('"\'=HYPERLINK(""你好"")"'));
  assert.ok(csv.includes('"150","50"'));
});

function quizFixture() {
  const writers = [];
  const buttons = [];
  const timers = [];
  const node = (tag, attrs = {}) => ({ ...attrs, tag, children: [], append(...children) { this.children.push(...children); }, appendChild(child) { this.children.push(child); return child; }, replaceChildren(...children) { this.children = children; }, addEventListener(event, callback) { this[event] = callback; } });
  const root = node('div');
  const context = vm.createContext({
    el: (tag, attrs) => { const result = node(tag, attrs); if (tag === 'button') buttons.push(result); return result; },
    subCharsOf: item => [...item.char], writerSize: () => 327,
    createGridWriter: () => { const writer = { quiz(callbacks) { this.callbacks = callbacks; }, cancelQuiz() {} }; writers.push(writer); return writer; },
    setTimeout: callback => { timers.push(callback); return callback; },
    clearTimeout: callback => { const i = timers.indexOf(callback); if (i >= 0) timers.splice(i, 1); }
  });
  vm.runInContext(readFileSync('public/shared/quiz-engine.js', 'utf8'), context);
  const ctx = { root, clearRoot() { root.replaceChildren(); }, setProgress() {} };
  return { context, ctx, writers, buttons, tick() { timers.shift()?.(); } };
}

test('multi-character words score only when fully completed, and skips ignore late callbacks', () => {
  const { context, ctx, writers, buttons, tick } = quizFixture();
  const tally = { correct: 0, total: 2 };
  let result;
  context.runQuizPhase(ctx, [{ char: '你好' }, { char: '学' }], 0, tally, 0, 2, {}, value => result = value);
  assert.equal(writers.length, 1, 'one large pad at a time');
  writers[0].callbacks.onMistake();
  writers[0].callbacks.onComplete({ totalMistakes: 1 });
  assert.equal(tally.completed, 0);
  tick();
  assert.equal(writers.length, 2);
  writers[1].callbacks.onComplete({ totalMistakes: 0 });
  assert.equal(tally.completed, 1);
  assert.equal(tally.correct, 0);
  tick();
  buttons.at(-1).click();
  assert.equal(result.skipped, 1);
  writers[2].callbacks.onComplete({ totalMistakes: 0 });
  assert.equal(tally.completed, 1);
  assert.equal(tally.mistakes, 1);
});

test('a perfect word earns full credit once, even if completion is reported twice', () => {
  const { context, ctx, writers, tick } = quizFixture();
  const tally = { correct: 0, total: 1 };
  let result;
  context.runQuizPhase(ctx, [{ char: '学' }], 0, tally, 0, 1, {}, value => result = value);
  writers[0].callbacks.onComplete({ totalMistakes: 0 });
  writers[0].callbacks.onComplete({ totalMistakes: 0 });
  tick();
  assert.equal(result.correct, 1);
  assert.equal(result.completed, 1);
  assert.equal(result.skipped, 0);
});
