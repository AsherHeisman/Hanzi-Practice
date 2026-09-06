document.getElementById('quiz-icon').appendChild(icon('bolt'));
const stackCards = [...document.querySelectorAll('.stack-card')];
if (stackCards.length && typeof HanziWriter !== 'undefined') {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const colors = [
    { strokeColor: '#d9f6bd', radicalColor: '#ff9b45', outlineColor: '#789d80' },
    { strokeColor: '#ffe0ac', radicalColor: '#ff9b45', outlineColor: '#a47d52' },
    { strokeColor: '#d2effb', radicalColor: '#ff9b45', outlineColor: '#688c9b' }
  ];
  const writers = stackCards.map((card, index) => {
    const pad = card.querySelector('.stack-grid');
    const character = pad.textContent.trim();
    pad.textContent = '';
    const speed = character === '习' ? 2 : 4;
    return createGridWriter(pad, character, 180, { 
      showCharacter: prefersReducedMotion, 
      showOutline: true, 
      strokeAnimationSpeed: speed,
      delayBetweenStrokes: 0,
      ...colors[index] 
    });
  });
  let index = 0;
  let isFirstLoad = true;
  const stackContainer = document.querySelector('.character-stack');
  const showNext = () => {
    stackCards.forEach((card, cardIndex) => {
      if (cardIndex === index) {
        card.style.zIndex = '';
        card.classList.add('is-active');
      } else if (card.classList.contains('is-active')) {
        card.style.zIndex = '2';
        card.classList.remove('is-active');
      } else {
        card.style.zIndex = '1';
        card.classList.remove('is-active');
      }
    });

    if (isFirstLoad) {
      isFirstLoad = false;
      setTimeout(() => {
        if (stackContainer) stackContainer.classList.add('initialized');
        index = (index + 1) % stackCards.length;
        showNext();
      }, 1500);
      return;
    }

    if (!prefersReducedMotion) {
      writers[index]?.animateCharacter({
        onComplete: () => {
          setTimeout(() => {
            index = (index + 1) % stackCards.length;
            showNext();
          }, 500);
        }
      });
    }
  };
  showNext();
}
loadAllBooks().then(books => books.forEach(({ book, data }) => {
  const stats = bookStats(data);
  document.getElementById(`book-${book.id}-meta`).textContent = `${stats.units} units · ${stats.chapters} chapters · ${stats.words} words`;
})).catch(() => {});

document.addEventListener('DOMContentLoaded', mountSiteChrome);
