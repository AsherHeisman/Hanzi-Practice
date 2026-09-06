let writer;
let configuration;
let grid;
const palette = () => {
  const styles = getComputedStyle(document.documentElement);
  return Object.fromEntries(['stroke', 'radical', 'grid', 'outline', 'drawing', 'hint'].map(key => [key, styles.getPropertyValue('--' + key).trim()]));
};
function send(event, message, revision = configuration?.revision) {
  window.webkit.messageHandlers.practice.postMessage({ event, message: message || '', revision });
}
function resize() {
  if (!writer || !grid) return;
  const size = Math.min(innerWidth, innerHeight);
  grid.setAttribute('width', size); grid.setAttribute('height', size);
  const coordinates = [[0,0,size,size],[size,0,0,size],[size/2,0,size/2,size],[0,size/2,size,size/2]];
  grid.querySelectorAll(':scope > line').forEach((line, i) => ['x1','y1','x2','y2'].forEach((key, n) => line.setAttribute(key, coordinates[i][n])));
  writer.updateDimensions({ width: size, height: size, padding: 18 });
}
window.startPractice = function(config) {
  if (writer) { writer.cancelQuiz(); writer.pauseAnimation(); }
  configuration = config;
  const currentRevision = config.revision;
  const report = (event, message) => send(event, message, currentRevision);
  const pad = document.getElementById('pad');
  pad.replaceChildren();
  grid = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  grid.id = 'writer';
  for (let i = 0; i < 4; i++) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('stroke', 'var(--grid)');
    grid.appendChild(line);
  }
  pad.appendChild(grid);
  const colors = palette();
  const size = Math.min(innerWidth, innerHeight);
  writer = HanziWriter.create('writer', config.character, {
    width: size, height: size, padding: 18, drawingWidth: 8,
    showCharacter: config.preview, showOutline: config.preview,
    strokeColor: colors.stroke, radicalColor: colors.radical,
    outlineColor: colors.outline, drawingColor: colors.drawing,
    highlightColor: colors.hint, highlightOnComplete: false,
    onLoadCharDataSuccess: () => report('ready'),
    onLoadCharDataError: () => report('error', 'Stroke data could not load. Check your connection and tap Retry.')
  });
  resize();
  if (config.preview) writer.animateCharacter();
  else writer.quiz({ showHintAfterMisses: 1, highlightOnComplete: false,
    onMistake: () => report('mistake'), onCorrectStroke: () => report('stroke'), onComplete: () => report('complete')
  });
};
window.addEventListener('resize', resize);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (!writer) return;
  const colors = palette();
  for (const [option, color] of [['strokeColor','stroke'],['radicalColor','radical'],['outlineColor','outline'],['drawingColor','drawing'],['highlightColor','hint']]) writer.updateColor(option, colors[color]);
});
