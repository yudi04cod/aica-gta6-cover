// Neon Coast Cover Lab — wires the page: photo slots, layout and grade
// pickers, lettering inputs, drag-to-pan and wheel-zoom on the preview, and
// PNG export in the three common post sizes. A `?shot=` query sets up a
// fixed scene for a screenshot instead (./shots.js).
import { drawCover, renderCover, freshState, loadFonts, panelRects, LAYOUTS, GRADES } from './cover.js';
import { runShot } from './shots.js';

const SIZES = {
  '1080x1080': [1080, 1080],
  '1080x1350': [1080, 1350],
  '1920x1080': [1920, 1080],
};
const SAMPLES = ['pier', 'boulevard'];

const canvas = document.getElementById('cover');
const status = document.getElementById('status');
const state = freshState();

/** Loads an image from a URL, resolving to the image once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function previewSize() {
  const ratio = canvas.width / canvas.height;
  const box = 1080;
  return ratio >= 1 ? [box, Math.round(box / ratio)] : [Math.round(box * ratio), box];
}

function redraw() {
  const [w, h] = previewSize();
  drawCover(canvas, state, w, h, { highlight: true });
  syncPanelControls();
}

function syncPanelControls() {
  const panel = state.panels[state.selected] ?? state.panels[0];
  const zoom = document.getElementById('zoom');
  zoom.value = String(panel.zoom);
  const hint = document.getElementById('panel-hint');
  const names = ['first', 'second', 'third', 'fourth'];
  hint.textContent = `Panel ${names[state.selected] ?? state.selected + 1} selected — ` +
    `photo ${panel.photo + 1}, zoom ${panel.zoom.toFixed(2)}×. Drag it to move, scroll to zoom.`;
}

function setStatus(text) {
  status.textContent = text;
}

/** Builds the three photo slots (thumbnail, name, file picker). */
function buildSlots() {
  const wrap = document.getElementById('slots');
  wrap.textContent = '';
  state.photos.forEach((photo, i) => {
    const row = document.createElement('div');
    row.className = 'slot';
    const thumb = document.createElement('img');
    thumb.alt = `Photo ${i + 1}`;
    if (photo) thumb.src = photo.src;
    const name = document.createElement('span');
    name.className = `slot-name${photo ? '' : ' empty'}`;
    name.textContent = photo ? (photo.dataset.name ?? `Photo ${i + 1}`) : `Photo ${i + 1} — empty`;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.id = `slot-file-${i}`;
    const pick = document.createElement('button');
    pick.type = 'button';
    pick.textContent = photo ? 'Replace' : 'Choose…';
    pick.addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      const img = await loadImage(URL.createObjectURL(file));
      img.dataset.name = file.name;
      state.photos[i] = img;
      buildSlots();
      redraw();
    });
    const assign = document.createElement('button');
    assign.type = 'button';
    assign.textContent = 'Use here';
    assign.title = 'Fill the selected panel with this photo';
    assign.disabled = !photo;
    assign.addEventListener('click', () => {
      state.panels[state.selected].photo = i;
      redraw();
    });
    row.append(thumb, name, input, pick, assign);
    wrap.append(row);
  });
}

/** Builds a row of toggle buttons from a {key: {label}} map. */
function buildChoices(id, options, current, onPick) {
  const wrap = document.getElementById(id);
  wrap.textContent = '';
  Object.entries(options).forEach(([key, opt]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = opt.label;
    if (key === current) b.classList.add('active');
    b.addEventListener('click', () => {
      onPick(key);
      wrap.querySelectorAll('button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
    });
    wrap.append(b);
  });
}

function bindText(id, key) {
  document.getElementById(id).addEventListener('input', (e) => {
    state[key] = e.target.value;
    redraw();
  });
}

function bindCheck(id, key) {
  document.getElementById(id).addEventListener('change', (e) => {
    state[key] = e.target.checked;
    redraw();
  });
}

function download(canvasEl, name) {
  canvasEl.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, 'image/png');
}

async function exportSize(key) {
  const [w, h] = SIZES[key];
  const out = renderCover(state, w, h);
  download(out, `neon-coast-cover-${key}.png`);
  setStatus(`Saved neon-coast-cover-${key}.png`);
}

document.getElementById('sample-photos').addEventListener('click', async () => {
  setStatus('Loading sample photos…');
  const loaded = await Promise.all(
    SAMPLES.map(async (name, i) => {
      const img = await loadImage(`samples/${name}.jpg`);
      img.dataset.name = `${name}.jpg (sample)`;
      return img;
    }),
  );
  loaded.forEach((img, i) => { state.photos[i] = img; });
  state.panels[0].photo = 0;
  state.panels[1].photo = 1;
  state.panels[2].photo = 0;
  state.panels[3].photo = 1;
  buildSlots();
  redraw();
  setStatus('Sample photos loaded — pick a layout and export.');
});

document.getElementById('zoom').addEventListener('input', (e) => {
  state.panels[state.selected].zoom = Number(e.target.value);
  redraw();
});
document.getElementById('fit').addEventListener('click', () => {
  const panel = state.panels[state.selected];
  panel.dx = 0;
  panel.dy = 0;
  panel.zoom = 1;
  redraw();
});
document.getElementById('flip').addEventListener('click', () => {
  state.panels[state.selected].flip = !state.panels[state.selected].flip;
  redraw();
});

document.querySelectorAll('button.export').forEach((b) => {
  b.addEventListener('click', () => exportSize(b.dataset.size));
});
document.getElementById('export-all').addEventListener('click', async () => {
  for (const key of Object.keys(SIZES)) {
    await exportSize(key);
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  setStatus('Saved all three sizes.');
});

/** Drag to pan the photo under the pointer; wheel to zoom it. */
let drag = null;
function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);
  return [x, y];
}
function pickPanel(x, y) {
  const rects = panelRects(state, canvas.width, canvas.height);
  return rects.findIndex(([rx, ry, rw, rh]) => x >= rx && x <= rx + rw && y >= ry && y <= ry + rh);
}
canvas.addEventListener('pointerdown', (e) => {
  const [x, y] = canvasPoint(e);
  const i = pickPanel(x, y);
  if (i < 0) return;
  state.selected = i;
  drag = { x, y, panel: state.panels[i] };
  canvas.classList.add('dragging');
  canvas.setPointerCapture(e.pointerId);
  redraw();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const [x, y] = canvasPoint(e);
  const rects = panelRects(state, canvas.width, canvas.height);
  const [rx, ry, rw, rh] = rects[state.selected];
  drag.panel.dx += (x - drag.x) / rw;
  drag.panel.dy += (y - drag.y) / rh;
  drag.x = x;
  drag.y = y;
  redraw();
});
canvas.addEventListener('pointerup', () => {
  drag = null;
  canvas.classList.remove('dragging');
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const [x, y] = canvasPoint(e);
  const i = pickPanel(x, y);
  if (i < 0) return;
  state.selected = i;
  const panel = state.panels[i];
  panel.zoom = Math.min(3, Math.max(1, panel.zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
  redraw();
}, { passive: false });

bindText('title', 'title');
bindText('subtitle', 'subtitle');
bindText('badge', 'badge');
bindCheck('grain', 'grain');
bindCheck('vignette', 'vignette');

buildSlots();
buildChoices('layouts', LAYOUTS, state.layout, (key) => {
  state.layout = key;
  if (state.selected >= LAYOUTS[key].panels.length) state.selected = 0;
  redraw();
});
buildChoices('grades', GRADES, state.grade, (key) => {
  state.grade = key;
  redraw();
});

const query = new URLSearchParams(location.search);
const shot = query.get('shot');
if (shot) {
  runShot(shot, query, { state, loadImage, redraw, buildSlots });
} else {
  loadFonts().then(redraw);
  redraw();
}
