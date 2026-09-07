document.getElementById('quiz-icon').appendChild(icon('bolt'));

async function startCharacterStack() {
  const stack = document.querySelector('.character-stack');
  const cards = [...stack.querySelectorAll('.stack-card')];
  const sequence = [
    { file: 'xue', draw: 1500, hold: 750, color: '#d9f6bd' },
    { file: 'xi', draw: 1000, hold: 1250, color: '#ffe0ac' },
    { file: 'xie', draw: 1500, hold: 750, color: '#d2effb' }
  ];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 780px)');
  const svgNode = (name, attributes) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', name);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    return node;
  };
  // Preload every character before starting the clock.
  const data = await Promise.all(sequence.map(async ({ file }) => {
    const response = await fetch(`/assets/hero-strokes/${file}.json`);
    if (!response.ok) throw new Error('Character data unavailable');
    return response.json();
  }));
  const drawings = data.map((character, cardIndex) => {
    const svg = svgNode('svg', { viewBox: '0 0 1024 1024', 'aria-hidden': 'true' });
    const group = svgNode('g', { transform: 'translate(0 900) scale(1 -1)' });
    const defs = svgNode('defs', {});
    svg.append(defs, group);
    const strokes = character.strokes.map((outline, strokeIndex) => {
      const id = `hero-clip-${cardIndex}-${strokeIndex}`;
      const clip = svgNode('clipPath', { id, clipPathUnits: 'userSpaceOnUse' });
      clip.append(svgNode('path', { d: outline }));
      defs.append(clip);
      group.append(svgNode('path', { d: outline, fill: sequence[cardIndex].color, opacity: '.1' }));
      const points = character.medians[strokeIndex];
      // Extend past the outline so the final rounded cap reveals the full stroke.
      const actual_length = points.slice(1).reduce((sum, point, i) => sum + Math.hypot(point[0] - points[i][0], point[1] - points[i][1]), 0);
      const dash_length = actual_length + 128;
      const path = svgNode('path', {
        d: 'M' + points.map(point => point.join(' ')).join(' L'), fill: 'none',
        stroke: character.radStrokes?.includes(strokeIndex) ? '#ffad60' : sequence[cardIndex].color,
        'stroke-width': 128, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        'stroke-dasharray': `${dash_length} ${dash_length}`, 'stroke-dashoffset': dash_length
      });
      const clipped = svgNode('g', { 'clip-path': `url(#${id})` });
      clipped.append(path);
      group.append(clipped);
      return { path, actual_length, dash_length };
    });
    cards[cardIndex].querySelector('.stack-grid').replaceChildren(svg);
    return { strokes, total: strokes.reduce((sum, stroke) => sum + stroke.actual_length, 0) };
  });
  function draw(index, progress) {
    let distance = drawings[index].total * progress;
    for (const { path, actual_length, dash_length } of drawings[index].strokes) {
      const fraction = Math.max(0, Math.min(1, distance / actual_length));
      path.style.strokeDashoffset = String(dash_length - actual_length * fraction) + 'px';
      path.style.opacity = fraction === 0 ? '0' : '1';
      distance -= actual_length;
    }
  }
  const rests = ['translate(-18px, 15px) rotate(-6deg)', 'translate(2px, 3px) rotate(1deg)', 'translate(18px, -10px) rotate(6deg)'];
  const fronts = [[-13, 5, -3], [2, -5, 1], [13, -17, 3]];
  const transform = ([x, y, angle]) => `translate(${x}px, ${y}px) rotate(${angle}deg)`;
  let index = 0;
  let phase = 'draw';
  let elapsed = 0;
  let previousTime;
  function activate() {
    cards.forEach((card, i) => {
      card.classList.toggle('is-active', i === index);
      card.style.zIndex = i === index ? '3' : '1';
      card.style.transform = i === index ? transform(fronts[i]) : rests[i];
    });
  }
  function reset() {
    index = 0; phase = 'draw'; elapsed = 0; previousTime = undefined;
    drawings.forEach((_, i) => draw(i, reduced.matches ? 1 : 0));
    activate();
  }
  reset();
  reduced.addEventListener('change', reset);
  const slideDuration = 450;
  function render() {
    stack.dataset.phase = phase;
    stack.dataset.character = sequence[index].file;
    if (phase === 'draw') draw(index, Math.min(1, elapsed / sequence[index].draw));
    if (phase === 'out' || phase === 'in') {
      const next = (index + 1) % cards.length;
      const t = Math.min(1, elapsed / slideDuration);
      const eased = t * t * (3 - 2 * t);
      const amount = phase === 'out' ? eased : 1 - eased;
      const [x, y, angle] = fronts[next];
      // Xi enters from the side; Xie rises above the stack.
      const rest = [[-18, 15, -6], [2, 3, 1], [18, -10, 6]][next];
      const start = phase === 'out' ? rest : fronts[next];
      const apex = [x + (next === 2 ? 0 : 120), y - (next === 2 ? 130 : 12), angle + (next === 2 ? -5 : 8)];
      cards[next].style.transform = transform(start.map((value, i) => value + (apex[i] - value) * amount));
    }
  }
  function advance() {
    if (phase === 'draw') { draw(index, 1); phase = 'hold'; }
    else if (phase === 'hold') {
      phase = 'out';
      const next = (index + 1) % cards.length;
      draw(next, 0);
      cards[next].style.zIndex = '2';
      cards[next].style.transform = rests[next];
    } else if (phase === 'out') {
      phase = 'in';
      const next = (index + 1) % cards.length;
      cards[index].classList.remove('is-active');
      cards[index].style.zIndex = '1';
      cards[index].style.transform = rests[index];
      cards[next].classList.add('is-active');
      cards[next].style.zIndex = '3';
    } else { index = (index + 1) % cards.length; phase = 'draw'; activate(); }
  }
  function frame(time) {
    if (document.hidden || mobile.matches || reduced.matches) previousTime = undefined;
    else {
      elapsed += previousTime === undefined ? 0 : time - previousTime;
      previousTime = time;
      let duration = phase === 'draw' ? sequence[index].draw : phase === 'hold' ? sequence[index].hold : slideDuration;
      while (elapsed >= duration) {
        elapsed -= duration;
        advance();
        duration = phase === 'draw' ? sequence[index].draw : phase === 'hold' ? sequence[index].hold : slideDuration;
      }
      render();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
startCharacterStack().catch((e) => {
  console.error('Stack error:', e);
  document.querySelector('.stack-card')?.classList.add('is-active');
});

loadAllBooks().then(books => books.forEach(({ book, data }) => {
  const stats = bookStats(data);
  document.getElementById(`book-${book.id}-meta`).textContent = `${stats.units} units · ${stats.chapters} chapters · ${stats.words} words`;
})).catch(() => {});
document.addEventListener('DOMContentLoaded', mountSiteChrome);
