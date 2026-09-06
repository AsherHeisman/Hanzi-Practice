// header/footer

const BOOKS = [
  { id: '1', file: '/data-textbook1.json', label: 'Go Far with Chinese 1' },
  { id: '2', file: '/data-textbook2.json', label: 'Go Far with Chinese 2' }
];

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else node.setAttribute(k, v);
  }
  children.forEach(c => node.appendChild(c));
  return node;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}


function cyclicSample(pool, count) {
  if (!pool.length) return [];
  let out = [];
  while (out.length < count) {
    out = out.concat(shuffle(pool));
  }
  return out.slice(0, count);
}


function flattenCharacters(data, { unitId = null, chapterId = null, includeContext = false } = {}) {
  const out = [];
  data.units.forEach(unit => {
    if (unitId && unit.id !== unitId) return;
    unit.chapters.forEach(chapter => {
      if (chapterId && chapter.id !== chapterId) return;
      chapter.sections.forEach(section => {
        (section.characters || []).forEach(item => {
          if (!item.char) return;
          out.push(includeContext ? { ...item, unit, chapter, section } : item);
        });
      });
    });
  });
  return out;
}

async function loadBook(file) {
  const res = await fetch(file);
  if (!res.ok) throw new Error('Failed to load ' + file);
  return res.json();
}

async function loadAllBooks() {
  const results = await Promise.all(BOOKS.map(async book => ({ book, data: await loadBook(book.file) })));
  return results;
}

function subCharsOf(item) {
  return Array.from(item.char || '').filter(char => /\p{Script=Han}/u.test(char));
}

function writerSize(numChars = 1, container = document.getElementById('app-root')) {
  const styles = container ? getComputedStyle(container) : null;
  const width = container?.clientWidth ? container.clientWidth - parseFloat(styles.paddingLeft || 0) - parseFloat(styles.paddingRight || 0) : window.innerWidth - 52;
  return Math.max(1, Math.floor(Math.min(width - 2, window.innerWidth <= 780 ? 380 : 340)));
}

let _writerIdCounter = 0;

function makeGridSvgTarget(size) {
  const id = 'hw-target-' + (_writerIdCounter++);
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('xmlns', ns);
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('id', id);
  svg.setAttribute('class', 'writer-box');
  const lines = [
    [0, 0, size, size],
    [size, 0, 0, size],
    [size / 2, 0, size / 2, size],
    [0, size / 2, size, size / 2]
  ];
  lines.forEach(([x1, y1, x2, y2]) => {
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    line.setAttribute('stroke', 'var(--border)');
    svg.appendChild(line);
  });
  return { svg, id };
}


function createGridWriter(container, char, size, options) {
  if (typeof HanziWriter === 'undefined') {
    if (!container.querySelector('.error-message')) container.appendChild(el('p', { class: 'error-message', text: 'The handwriting tool could not load. Check your connection, then reload this page.' }));
    return { animateCharacter() {}, quiz() {}, cancelQuiz() {} };
  }
  const { svg, id } = makeGridSvgTarget(size);
  container.appendChild(svg);
  const colors = getComputedStyle(document.documentElement);
  const writer = HanziWriter.create(id, char, Object.assign({ width: size, height: size, padding: 16, drawingWidth: 8, strokeColor: colors.getPropertyValue('--stroke').trim(), radicalColor: colors.getPropertyValue('--radical').trim(), outlineColor: colors.getPropertyValue('--ink-wash-strong').trim(), drawingColor: colors.getPropertyValue('--accent').trim(), highlightColor: colors.getPropertyValue('--stroke-hint').trim(), onLoadCharDataError: () => { if (svg.isConnected) container.appendChild(el('p', { class: 'error-message', text: 'Stroke data could not load for ' + char + '. Check your connection or skip this word.' })); } }, options));
  const theme = matchMedia('(prefers-color-scheme: dark)');
  const update = () => { if (!svg.isConnected) { theme.removeEventListener('change', update); return; } const c = getComputedStyle(document.documentElement); writer.updateColor('strokeColor', c.getPropertyValue('--stroke').trim()); writer.updateColor('radicalColor', c.getPropertyValue('--radical').trim()); writer.updateColor('highlightColor', c.getPropertyValue('--stroke-hint').trim()); writer.updateColor('outlineColor', c.getPropertyValue('--ink-wash-strong').trim()); writer.updateColor('drawingColor', c.getPropertyValue('--accent').trim()); };
  theme.addEventListener('change', update);
  let observer;
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => {
      if (!svg.isConnected) { observer.disconnect(); theme.removeEventListener('change', update); return; }
      const next = writerSize(1, container);
      if (next === Number(svg.getAttribute('width'))) return;
      svg.setAttribute('width', next);
      svg.setAttribute('height', next);
      const coordinates = [[0, 0, next, next], [next, 0, 0, next], [next / 2, 0, next / 2, next], [0, next / 2, next, next / 2]];
      [...svg.children].filter(node => node.tagName.toLowerCase() === 'line').forEach((line, index) => ['x1', 'y1', 'x2', 'y2'].forEach((key, n) => line.setAttribute(key, coordinates[index][n])));
      writer.updateDimensions({ width: next, height: next, padding: 16 });
    });
    observer.observe(container);
  }
  writer.dispose = () => {
    observer?.disconnect();
    theme.removeEventListener('change', update);
    writer.cancelQuiz();
    writer.pauseAnimation();
  };
  return writer;
}

// main site header and footer
function buildHeader(activePage) {
  const header = el('header', { class: 'site-header' });
  const inner = el('div', { class: 'site-header-inner' });

  const brand = el('a', { class: 'brand', href: '/' }, [
    el('span', { class: 'brand-mark', text: '字', 'aria-hidden': 'true' }),
    el('span', { text: 'Hanzi Learning' })
  ]);

  const navLinks = [
    { href: '/', key: 'home', label: 'Overview' },
    { href: '/textbook/1', key: 'textbook1', label: 'Go Far with Chinese 1' },
    { href: '/textbook/2', key: 'textbook2', label: 'Go Far with Chinese 2' },
    { href: '/quiz', key: 'popquiz', label: 'Pop Quiz' }
  ];
  const nav = el('nav', { class: 'site-nav', id: 'site-nav' });
  navLinks.forEach(link => {
    const a = el('a', { href: link.href, text: link.label });
    if (link.key === activePage) { a.classList.add('active'); a.setAttribute('aria-current', 'page'); }
    nav.appendChild(a);
  });

  const search = el('div', { class: 'site-search' });
  const searchBox = el('div', { class: 'site-search-box' }, [
    icon('search'),
    el('input', { type: 'text', id: 'site-search-input', placeholder: 'Hanzi, pinyin, or meaning…', autocomplete: 'off', 'aria-label': 'Search vocabulary', 'aria-controls': 'site-search-results' })
  ]);
  const searchResults = el('div', { class: 'site-search-results hidden', id: 'site-search-results' });
  search.appendChild(searchBox);
  search.appendChild(searchResults);

  const navToggle = el('button', { class: 'nav-toggle', id: 'nav-toggle', type: 'button', 'aria-label': 'Menu' }, [
    icon('menu')
  ]);

  inner.appendChild(brand);
  inner.appendChild(nav);
  inner.appendChild(search);
  inner.appendChild(navToggle);
  header.appendChild(inner);

  navToggle.setAttribute('aria-expanded', 'false');
  navToggle.setAttribute('aria-controls', 'site-nav');
  navToggle.addEventListener('click', () => navToggle.setAttribute('aria-expanded', String(nav.classList.toggle('open'))));

  return header;
}

function buildFooter() {
  const footer = el('footer', { class: 'site-footer' });
  const inner = el('div', { class: 'site-footer-inner' });
  
  const links = el('nav', { class: 'footer-links' }, [
    el('a', { href: '/', text: 'Home' }),
    el('a', { href: '/progress', text: 'My progress' }),
    el('a', { href: '/admin', text: 'Admin' }),
    el('a', { href: '/feedback', text: 'Feedback' }),
    el('a', { href: '/about', text: 'About & privacy' })

  ]);
  inner.appendChild(links);
  footer.appendChild(inner);
  return footer;
}

function initHeaderSearch() {
  const input = document.getElementById('site-search-input');
  const results = document.getElementById('site-search-results');
  if (!input || !results) return;

  let allItems = null; 

  async function ensureLoaded() {
    if (allItems) return allItems;
    const loaded = await loadAllBooks();
    allItems = [];
    loaded.forEach(({ book, data }) => {
      flattenCharacters(data, { includeContext: true }).forEach(item => {
        allItems.push({ ...item, book });
      });
    });
    return allItems;
  }

  function renderResults(matches, query) {
    results.innerHTML = '';
    if (!query) { results.classList.add('hidden'); return; }

    if (matches.length === 0) {
      results.appendChild(el('p', { class: 'site-search-empty', text: 'No matches.' }));
    }

    matches.slice(0, 8).forEach(item => {
      const row = el('a', { class: 'site-search-result', href: '#' });
      row.appendChild(el('span', { class: 'site-search-char', text: item.char }));
      row.appendChild(el('span', {
        class: 'site-search-meta',
        text: `${item.pinyin || ''} - ${item.meaning || ''} · ${item.book.label}`
      }));
      row.addEventListener('click', (e) => {
        e.preventDefault();
        const params = new URLSearchParams({ char: item.char, pinyin: item.pinyin || '', meaning: item.meaning || '' });
        window.location.href = '/practice?' + params.toString();
      });
      results.appendChild(row);
    });

    const isChineseText = /^[\p{Script=Han}]{1,20}$/u.test(query);
    const exactMatch = matches.some(m => m.char === query);
    if (isChineseText && !exactMatch) {
      const row = el('a', { class: 'site-search-result', href: '#' });
      row.appendChild(el('span', { class: 'site-search-char', text: query }));
      row.appendChild(el('span', { class: 'site-search-meta', text: 'Not in your data - practice it anyway' }));
      row.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = '/practice?' + new URLSearchParams({ char: query }).toString();
      });
      results.appendChild(row);
    }

    results.classList.remove('hidden');
  }

  input.addEventListener('input', async () => {
    const q = input.value.trim();
    if (!q) { results.classList.add('hidden'); results.innerHTML = ''; return; }
    let items;
    try { items = await ensureLoaded(); } catch { results.replaceChildren(el('p', { class: 'site-search-empty', text: 'Could not load vocabulary. Please try again.' })); results.classList.remove('hidden'); return; }
    if (input.value.trim() !== q) return;
    const normalize = value => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const qLower = normalize(q);
    const matches = items.filter(item =>
      (item.char && item.char.includes(q)) ||
      (item.pinyin && normalize(item.pinyin).includes(qLower)) ||
      (item.meaning && item.meaning.toLowerCase().includes(qLower))
    );
    renderResults(matches, q);
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') results.classList.add('hidden');
    if (e.key === 'ArrowDown') { e.preventDefault(); results.querySelector('a')?.focus(); }
    if (e.key === 'Enter' && !results.classList.contains('hidden')) results.querySelector('a')?.click();
  });
  document.addEventListener('click', (e) => {
    if (!search_contains(e.target)) results.classList.add('hidden');
  });
  function search_contains(target) {
    return input.contains(target) || results.contains(target);
  }
}

function mountSiteChrome() {
  document.body.prepend(el('a', { class: 'skip-link', href: '#main-content', text: 'Skip to content' }));
  const headerMount = document.getElementById('site-header');
  const footerMount = document.getElementById('site-footer');
  const activePage = document.body.getAttribute('data-page') || '';

  if (headerMount) {
    headerMount.appendChild(buildHeader(activePage));
    initHeaderSearch();
  }
  if (footerMount) {
    footerMount.appendChild(buildFooter());
  }
}


//YC

function icon(name) {
  const names = { search: 'search', menu: 'menu', arrow: 'arrow_forward', outward: 'arrow_outward', back: 'arrow_back', pen: 'edit', lock: 'lock', bolt: 'bolt', backspace: 'backspace', close: 'close', download: 'download' };
  return el('span', { class: 'material-symbols-outlined icon', 'aria-hidden': 'true', text: names[name] || 'arrow_forward' });
}
function bookStats(data) {
  const chapters = data.units.flatMap(u => u.chapters);
  const sections = chapters.flatMap(c => c.sections);
  return { units: data.units.length, chapters: chapters.length, sections: sections.length, words: sections.reduce((n, s) => n + s.characters.length, 0) };
}
