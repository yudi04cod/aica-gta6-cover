// Neon Coast Cover Lab — the cover engine. Draws a multi-panel poster cover
// (hero panel plus smaller panels, white gutters, a sunset or neon grade and
// big gradient lettering) onto any 2D canvas, at any size, from plain state.
// Nothing here reaches the network: photos are images the user loaded, fonts
// are the app's own files, and the grain is a seeded pattern made in memory.

/** The four layouts, each a list of panel rects as fractions of the cover. */
export const LAYOUTS = {
  poster: {
    label: 'Poster · hero + 3',
    panels: [
      [0, 0, 1, 0.6],
      [0, 0.6, 1 / 3, 0.4],
      [1 / 3, 0.6, 1 / 3, 0.4],
      [2 / 3, 0.6, 1 / 3, 0.4],
    ],
  },
  trio: {
    label: 'Trio · 3 strips',
    panels: [
      [0, 0, 1 / 3, 1],
      [1 / 3, 0, 1 / 3, 1],
      [2 / 3, 0, 1 / 3, 1],
    ],
  },
  duo: {
    label: 'Duo · hero + 2',
    panels: [
      [0, 0, 1, 0.55],
      [0, 0.55, 0.5, 0.45],
      [0.5, 0.55, 0.5, 0.45],
    ],
  },
  solo: {
    label: 'Solo · full bleed',
    panels: [[0, 0, 1, 1]],
  },
};

/** The four colour grades: a saturating filter plus a two-stop wash. */
export const GRADES = {
  sunset: {
    label: 'Sunset',
    filter: 'saturate(1.45) contrast(1.08) brightness(1.02)',
    top: 'rgba(255, 176, 66, 0.22)',
    bottom: 'rgba(255, 46, 136, 0.46)',
  },
  neon: {
    label: 'Neon Nights',
    filter: 'saturate(1.55) contrast(1.07)',
    top: 'rgba(45, 226, 230, 0.24)',
    bottom: 'rgba(255, 46, 136, 0.5)',
  },
  dusk: {
    label: 'Dusk',
    filter: 'saturate(1.3) contrast(1.1) brightness(0.98)',
    top: 'rgba(139, 92, 246, 0.26)',
    bottom: 'rgba(16, 8, 54, 0.46)',
  },
  golden: {
    label: 'Golden Hour',
    filter: 'saturate(1.45) contrast(1.06) brightness(1.04)',
    top: 'rgba(255, 214, 102, 0.28)',
    bottom: 'rgba(255, 110, 40, 0.34)',
  },
};

/** A fresh cover state: three photo slots, four panels, poster layout. */
export function freshState() {
  return {
    layout: 'poster',
    grade: 'sunset',
    title: 'Sunset Heist',
    subtitle: 'one last ride',
    badge: 'NEON COAST',
    grain: true,
    vignette: true,
    photos: [null, null, null],
    panels: [
      // The hero is much wider than a phone photo, so it starts framed a
      // little high, where faces usually are, instead of dead centre.
      { photo: 0, zoom: 1, dx: 0, dy: 0.2, flip: false },
      { photo: 1, zoom: 1, dx: 0, dy: 0, flip: false },
      { photo: 2, zoom: 1, dx: 0, dy: 0, flip: false },
      { photo: 0, zoom: 1, dx: 0, dy: 0, flip: false },
    ],
    selected: 0,
  };
}

/** A tiny seeded random generator, so the grain is the same every export. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const grainCache = new Map();

/** A small tiled noise canvas, cached per cover size. */
function grainTile(w, h) {
  const key = `${w}x${h}`;
  if (grainCache.has(key)) return grainCache.get(key);
  const tile = document.createElement('canvas');
  tile.width = 180;
  tile.height = 180;
  const tctx = tile.getContext('2d');
  const img = tctx.createImageData(180, 180);
  const rnd = mulberry32(20261119);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(rnd() * 255);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  tctx.putImageData(img, 0, 0);
  const pattern = { tile, key };
  grainCache.set(key, pattern);
  return pattern;
}

/** Shrinks a font until `text` fits `maxWidth`, returning the size used. */
function fitFont(ctx, text, family, weight, startSize, maxWidth) {
  let size = startSize;
  ctx.font = `${weight} ${size}px ${family}`;
  while (size > 10 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

/** Draws one photo into a panel rect, cover-fit, with zoom, pan and flip. */
function drawPanelPhoto(ctx, photo, rect, panel, grade) {
  const [rx, ry, rw, rh] = rect;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rx, ry, rw, rh);
  ctx.clip();
  if (photo) {
    const iw = photo.naturalWidth;
    const ih = photo.naturalHeight;
    const base = Math.max(rw / iw, rh / ih) * panel.zoom;
    const dw = iw * base;
    const dh = ih * base;
    // Pan is clamped to the slack the zoom leaves, so a panel never shows
    // a gap at its edge: a photo that exactly fills one axis cannot move
    // along that axis at all.
    const ox = Math.max(-(dw - rw) / 2, Math.min((dw - rw) / 2, panel.dx * rw));
    const oy = Math.max(-(dh - rh) / 2, Math.min((dh - rh) / 2, panel.dy * rh));
    const cx = rx + rw / 2 + ox;
    const cy = ry + rh / 2 + oy;
    ctx.filter = grade.filter;
    if (panel.flip) {
      ctx.translate(cx, cy);
      ctx.scale(-1, 1);
      ctx.drawImage(photo, -dw / 2, -dh / 2, dw, dh);
    } else {
      ctx.drawImage(photo, cx - dw / 2, cy - dh / 2, dw, dh);
    }
    ctx.filter = 'none';
  } else {
    const empty = ctx.createLinearGradient(rx, ry, rx, ry + rh);
    empty.addColorStop(0, '#3a2347');
    empty.addColorStop(1, '#1c0f28');
    ctx.fillStyle = empty;
    ctx.fillRect(rx, ry, rw, rh);
    ctx.fillStyle = 'rgba(244, 238, 247, 0.55)';
    ctx.font = `600 ${Math.max(12, rw * 0.045)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Add a photo', rx + rw / 2, ry + rh / 2);
  }
  const wash = ctx.createLinearGradient(0, ry, 0, ry + rh);
  wash.addColorStop(0, grade.top);
  wash.addColorStop(1, grade.bottom);
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = wash;
  ctx.fillRect(rx, ry, rw, rh);
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

/** The badge pill in the top corner. */
function drawBadge(ctx, w, h, text) {
  const label = text.trim().toUpperCase();
  if (!label) return;
  const size = Math.max(14, w * 0.02);
  ctx.font = `${size}px Anton, sans-serif`;
  const padX = size * 0.9;
  const tw = ctx.measureText(label).width;
  const bx = w * 0.035;
  const by = h * 0.035;
  const bh = size * 2.1;
  const bw = tw + padX * 2;
  ctx.save();
  ctx.fillStyle = 'rgba(12, 5, 18, 0.72)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = Math.max(1.5, w * 0.0012);
  roundRect(ctx, bx, by, bw, bh, bh / 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, bx + padX, by + bh / 2 + size * 0.04);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The title block: neon script subtitle over big gradient capitals. */
function drawLettering(ctx, w, h, state) {
  const bandTop = h * 0.74;
  const band = ctx.createLinearGradient(0, bandTop, 0, h);
  band.addColorStop(0, 'rgba(10, 4, 16, 0)');
  band.addColorStop(0.45, 'rgba(10, 4, 16, 0.55)');
  band.addColorStop(1, 'rgba(10, 4, 16, 0.88)');
  ctx.fillStyle = band;
  ctx.fillRect(0, bandTop, w, h - bandTop);

  const title = state.title.trim().toUpperCase();
  const sub = state.subtitle.trim();
  const cx = w / 2;
  const titleBase = h * 0.94;
  if (sub) {
    const subSize = fitFont(ctx, sub, 'Pacifico, cursive', 400, h * 0.052, w * 0.7);
    ctx.save();
    ctx.translate(cx, h * 0.815);
    ctx.rotate(-0.02);
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ff2e88';
    ctx.shadowBlur = subSize * 0.7;
    ctx.fillStyle = '#ffd7ef';
    ctx.fillText(sub, 0, 0);
    ctx.restore();
  }
  if (title) {
    const size = fitFont(ctx, title, 'Anton, sans-serif', 400, h * 0.115, w * 0.92);
    const grad = ctx.createLinearGradient(0, titleBase - size, 0, titleBase);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.55, '#ffd166');
    grad.addColorStop(1, '#ff7a3d');
    ctx.save();
    ctx.translate(cx, titleBase);
    ctx.rotate(-0.012);
    ctx.font = `${size}px Anton, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(16, 4, 24, 0.92)';
    ctx.lineWidth = size * 0.09;
    ctx.strokeText(title, 0, 0);
    ctx.shadowColor = 'rgba(255, 46, 136, 0.55)';
    ctx.shadowBlur = size * 0.12;
    ctx.fillStyle = grad;
    ctx.fillText(title, 0, 0);
    ctx.restore();
  }
}

/**
 * Draws the whole cover onto `canvas` (resized to W x H) from `state`.
 * `opts.highlight` strokes the selected panel, for the live preview only.
 */
export function drawCover(canvas, state, width, height, opts = {}) {
  const W = width ?? canvas.width;
  const H = height ?? canvas.height;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  const layout = LAYOUTS[state.layout] ?? LAYOUTS.poster;

  ctx.fillStyle = '#f4eef7';
  ctx.fillRect(0, 0, W, H);
  const gutter = Math.max(4, Math.round(Math.min(W, H) * 0.008));
  layout.panels.forEach((frac, i) => {
    const rect = [
      frac[0] * W + gutter,
      frac[1] * H + gutter,
      frac[2] * W - gutter * 2,
      frac[3] * H - gutter * 2,
    ];
    const panel = state.panels[i] ?? { photo: 0, zoom: 1, dx: 0, dy: 0, flip: false };
    drawPanelPhoto(ctx, state.photos[panel.photo] ?? null, rect, panel, grade);
  });

  drawLettering(ctx, W, H, state);
  drawBadge(ctx, W, H, state.badge);

  if (state.vignette) {
    const vg = ctx.createRadialGradient(
      W / 2, H / 2, Math.min(W, H) * 0.42,
      W / 2, H / 2, Math.max(W, H) * 0.75,
    );
    vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vg.addColorStop(1, 'rgba(8, 2, 14, 0.38)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }
  if (state.grain) {
    const { tile } = grainTile(W, H);
    const pattern = ctx.createPattern(tile, 'repeat');
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  if (opts.highlight && state.selected != null) {
    const frac = layout.panels[state.selected];
    if (frac) {
      ctx.save();
      ctx.strokeStyle = '#2de2e6';
      ctx.lineWidth = Math.max(3, Math.min(W, H) * 0.006);
      ctx.setLineDash([18, 10]);
      ctx.strokeRect(
        frac[0] * W + gutter / 2, frac[1] * H + gutter / 2,
        frac[2] * W - gutter, frac[3] * H - gutter,
      );
      ctx.restore();
    }
  }
  return canvas;
}

/** Renders the cover at an export size and returns the fresh canvas. */
export function renderCover(state, width, height) {
  const canvas = document.createElement('canvas');
  drawCover(canvas, state, width, height);
  return canvas;
}

/** Panel rects in pixels, for hit-testing a click on the preview. */
export function panelRects(state, width, height) {
  const layout = LAYOUTS[state.layout] ?? LAYOUTS.poster;
  const gutter = Math.max(4, Math.round(Math.min(width, height) * 0.008));
  return layout.panels.map((frac) => [
    frac[0] * width + gutter,
    frac[1] * height + gutter,
    frac[2] * width - gutter * 2,
    frac[3] * height - gutter * 2,
  ]);
}

/** Loads the display fonts the lettering needs, then resolves. */
export async function loadFonts() {
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('400 80px Anton'),
        document.fonts.load('400 40px Pacifico'),
      ]),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
  } catch {
    // The canvas falls back to system fonts; the cover still draws.
  }
  await document.fonts.ready.catch(() => undefined);
}
