const PREVIEW_WRITER_OPTIONS = {
  showOutline: true, strokeAnimationSpeed: 1, delayBetweenStrokes: 300
};
const LEARNING_QUIZ_OPTIONS = { showHintAfterMisses: 2, highlightOnComplete: true };
const POP_QUIZ_WRITER_OPTIONS = { showCharacter: false, showOutline: false, showHintAfterMisses: 1, highlightOnComplete: false };

function runLearnPhase(ctx, items, index, total, onDone) {
  ctx.clearRoot();
  if (index >= items.length) return onDone();
  ctx.setProgress(index, total, `Preview ${index + 1} of ${items.length}`);
  const item = items[index];
  const characters = subCharsOf(item);
  let characterIndex = 0;
  ctx.root.appendChild(el('h2', { text: `Preview: ${item.char}` }));
  ctx.root.appendChild(el('p', { text: `${item.pinyin || ''} - ${item.meaning || ''}` }));
  const position = el('p', { class: 'writer-position' });
  const row = el('div', { class: 'word-writer-row' });
  ctx.root.append(position, row);
  const controls = el('div', { class: 'controls' });
  const replay = el('button', { class: 'secondary', text: 'Replay animation' });
  const next = el('button');
  controls.append(replay, next);
  ctx.root.appendChild(controls);
  let writer;
  function showCharacter() {
    writer?.dispose?.();
    row.replaceChildren();
    position.textContent = `Character ${characterIndex + 1} of ${characters.length}`;
    writer = createGridWriter(row, characters[characterIndex], writerSize(1, row), PREVIEW_WRITER_OPTIONS);
    writer.animateCharacter();
    next.textContent = characterIndex < characters.length - 1 ? 'Next character' : index === items.length - 1 ? 'Start quiz' : 'Next word';
  }
  replay.addEventListener('click', () => writer.animateCharacter());
  next.addEventListener('click', () => {
    if (++characterIndex < characters.length) showCharacter();
    else { writer?.dispose?.(); runLearnPhase(ctx, items, index + 1, total, onDone); }
  });
  showCharacter();
}

function runQuizPhase(ctx, items, index, tally, progressBase, progressTotal, quizOptions, onDone) {
  ctx.clearRoot();
  if (index === 0) Object.assign(tally, { completed: 0, skipped: 0, mistakes: 0 });
  if (index >= items.length) return onDone(tally);
  ctx.setProgress(progressBase + index, progressTotal, `Quiz ${index + 1} of ${items.length}`);
  const item = items[index];
  const characters = subCharsOf(item);
  let characterIndex = 0;
  let anyMistake = false;
  let advanced = false;
  let wordCompleted = false;
  let writer;
  let timer;

  ctx.root.appendChild(el('h2', { text: `${item.pinyin || ''} - ${item.meaning || ''}` }));
  const position = el('p', { class: 'writer-position' });
  const row = el('div', { class: 'word-writer-row' });
  const feedback = el('p', { id: 'quiz-feedback', role: 'status', 'aria-live': 'polite' });
  const controls = el('div', { class: 'controls' });
  const skip = el('button', { class: 'secondary', text: 'Skip word' });
  controls.appendChild(skip);
  ctx.root.append(position, row, feedback, controls);

  function advance() {
    if (advanced) return;
    advanced = true;
    clearTimeout(timer);
    writer?.dispose?.();
    writer?.cancelQuiz();
    if (!wordCompleted) tally.skipped++;
    runQuizPhase(ctx, items, index + 1, tally, progressBase, progressTotal, quizOptions, onDone);
  }
  function showCharacter() {
    writer?.dispose?.();
    row.replaceChildren();
    position.textContent = `Draw character ${characterIndex + 1} of ${characters.length}`;
    let characterDone = false;
    let characterMistakes = 0;
    writer = createGridWriter(row, characters[characterIndex], writerSize(1, row), quizOptions);
    writer.quiz({
      ...quizOptions,
      onMistake() {
        if (advanced || characterDone) return;
        anyMistake = true;
        characterMistakes++;
        tally.mistakes++;
        feedback.textContent = 'Not quite - try that stroke again.';
        feedback.className = 'incorrect';
      },
      onCorrectStroke() {
        if (advanced || characterDone) return;
        feedback.textContent = 'Good stroke!';
        feedback.className = 'correct';
      },
      onComplete(summary) {
        if (advanced || characterDone) return;
        characterDone = true;
        const mistakes = Math.max(characterMistakes, summary.totalMistakes || 0);
        tally.mistakes += mistakes - characterMistakes;
        if (mistakes) anyMistake = true;
        if (++characterIndex < characters.length) {
          feedback.textContent = 'Character complete. Keep going.';
          timer = setTimeout(() => { if (!advanced) showCharacter(); }, 450);
        } else {
          wordCompleted = true;
          tally.completed++;
          if (!anyMistake) tally.correct++;
          feedback.textContent = anyMistake ? 'Word completed with corrections. +50 points' : 'Correct - nicely done! +100 points';
          feedback.className = 'correct';
          skip.disabled = true;
          timer = setTimeout(advance, 900);
        }
      }
    });
  }
  skip.addEventListener('click', advance);
  showCharacter();
}

function showQuizResults(ctx, tally, title, actions) {
  ctx.clearRoot();
  const record = ScoreHistory.makeRecord(tally, {
    mode: ctx.scoreMode,
    scope: document.getElementById('breadcrumb-info')?.textContent || title
  });
  const saved = ScoreHistory.save(record);
  ctx.root.appendChild(el('h2', { text: title }));
  ctx.root.appendChild(el('div', { id: 'score-summary' }, [
    el('strong', { class: 'score-value', text: `${ScoreHistory.percent(record)}%` }),
    el('span', { text: `${ScoreHistory.points(record)} / ${record.total * 100} points` })
  ]));
  ctx.root.appendChild(el('p', { class: 'score-details', text: `${record.correct} first try · ${record.completed - record.correct} with corrections · ${record.skipped} skipped` }));
  ctx.root.appendChild(el('p', { class: 'score-details', text: 'Each word earns 100 points on the first try, 50 with corrections, or 0 if skipped.' }));
  ctx.root.appendChild(el('p', { class: saved.saved ? 'muted' : 'error-message', role: 'status', text: saved.saved ? 'Saved to this browser. Find this session in My progress.' : saved.error }));
  const controls = el('div', { class: 'controls' });
  actions.forEach(action => {
    const button = el('button', { text: action.label });
    button.addEventListener('click', action.onClick);
    controls.appendChild(button);
  });
  ctx.root.appendChild(controls);
  const historyControls = el('div', { class: 'controls' }, [el('a', { class: 'button secondary', href: '/progress', text: 'My progress' })]);
  const exportButton = el('button', { class: 'secondary', text: 'Export this session' }, [icon('download')]);
  exportButton.addEventListener('click', () => ScoreHistory.download([record]));
  historyControls.appendChild(exportButton);
  ctx.root.appendChild(historyControls);
}
