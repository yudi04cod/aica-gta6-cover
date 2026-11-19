// Fixed scenes for screenshots: ?shot=editor shows the page with sample
// photos loaded; ?shot=cover shows the cover alone, drawn by the app itself
// at the size the query names. window.__shotReady is set once painted, so a
// screenshot tool can wait for it before capturing.
import { drawCover, loadFonts } from './cover.js';

async function loadSample(name) {
  const img = new Image();
  img.src = `samples/${name}.jpg`;
  img.dataset.name = `${name}.jpg (sample)`;
  await img.decode();
  return img;
}

function ready() {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__shotReady = true;
  }));
}

/**
 * Runs one screenshot scene. `query` carries the scene's knobs:
 * photo/photo2 (sample names), layout, grade, title, subtitle, badge,
 * and w/h for the cover size. `app` is the live page wiring.
 */
export async function runShot(shot, query, app) {
  const { state, redraw, buildSlots } = app;
  const pier = await loadSample(query.get('photo') ?? 'pier');
  const boulevard = await loadSample(query.get('photo2') ?? 'boulevard');
  state.photos[0] = pier;
  state.photos[1] = boulevard;
  state.photos[2] = pier;
  state.panels[0].photo = 0;
  state.panels[1].photo = 1;
  state.panels[2].photo = 0;
  state.panels[3].photo = 1;
  state.layout = query.get('layout') ?? state.layout;
  state.grade = query.get('grade') ?? state.grade;
  state.title = query.get('title') ?? state.title;
  state.subtitle = query.get('subtitle') ?? state.subtitle;
  state.badge = query.get('badge') ?? state.badge;
  // Per-panel framing knobs for a scene: dy0..dy3 shift a panel's photo
  // vertically (positive shows the top of the photo), zoom0..zoom3 zoom it.
  for (let i = 0; i < 4; i += 1) {
    const dy = query.get(`dy${i}`);
    const zoom = query.get(`zoom${i}`);
    if (dy !== null) state.panels[i].dy = Number(dy);
    if (zoom !== null) state.panels[i].zoom = Number(zoom);
  }
  buildSlots();

  const titleInput = document.getElementById('title');
  const subtitleInput = document.getElementById('subtitle');
  const badgeInput = document.getElementById('badge');
  if (titleInput) titleInput.value = state.title;
  if (subtitleInput) subtitleInput.value = state.subtitle;
  if (badgeInput) badgeInput.value = state.badge;
  await loadFonts();

  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    const w = Number(query.get('w') ?? 1080);
    const h = Number(query.get('h') ?? 1080);
    const canvas = document.getElementById('cover');
    drawCover(canvas, state, w, h);
    ready();
    return;
  }
  redraw();
  ready();
}
