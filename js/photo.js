// On-device photo work: resizing, thumbnails, and a clean "cut-out" product
// image built from the outline Gemini returns. No uploads happen here.

import { detectColor } from './engine.js';

export const STUDIO_BG = '#f1eee8';

export async function loadImage(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}

export function drawTo(img, max) {
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const scale = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale); c.height = Math.round(h * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c;
}

export const canvasBlob = (c, q = 0.85) => new Promise(res => c.toBlob(res, 'image/jpeg', q));

/** Normalise a new photo: a 1400px original plus its detected colour. */
export async function prepare(file) {
  const img = await loadImage(file);
  const big = drawTo(img, 1400), small = drawTo(img, 360);
  return { original: await canvasBlob(big, 0.86), img, color: detectColor(small) };
}

export async function thumbOf(blob, max = 420) {
  return canvasBlob(drawTo(await loadImage(blob), max), 0.8);
}

/** Colour of a region, used to give each detected garment its own colour guess. */
export function colorIn(img, box) {
  const [y0, x0, y1, x1] = box.map(v => v / 1000);
  const w = img.naturalWidth, h = img.naturalHeight;
  const c = document.createElement('canvas');
  const cw = Math.max(1, Math.round((x1 - x0) * w)), ch = Math.max(1, Math.round((y1 - y0) * h));
  const scale = Math.min(1, 300 / Math.max(cw, ch));
  c.width = Math.max(1, Math.round(cw * scale)); c.height = Math.max(1, Math.round(ch * scale));
  c.getContext('2d').drawImage(img, x0 * w, y0 * h, cw, ch, 0, 0, c.width, c.height);
  return detectColor(c);
}

/**
 * Build a shop-style image on-device: crop to the garment, cut along the
 * outline if we have one, centre it on a studio background with a soft shadow.
 */
export async function cutout(img, garment, { width = 900, height = 1200 } = {}) {
  const W = img.naturalWidth, H = img.naturalHeight;
  let [y0, x0, y1, x1] = (garment.box_2d || [0, 0, 1000, 1000]).map(v => Math.min(1000, Math.max(0, v)) / 1000);
  if (x1 - x0 < 0.05 || y1 - y0 < 0.05) [y0, x0, y1, x1] = [0, 0, 1, 1];
  const pts = Array.isArray(garment.outline) && garment.outline.length >= 12 && garment.outline.length % 2 === 0 ? garment.outline : null;

  // 1. the garment on a transparent layer, at source resolution
  const sx = x0 * W, sy = y0 * H, sw = (x1 - x0) * W, sh = (y1 - y0) * H;
  const layer = document.createElement('canvas');
  layer.width = Math.round(sw); layer.height = Math.round(sh);
  const lg = layer.getContext('2d');
  if (pts) {
    lg.beginPath();
    for (let i = 0; i < pts.length; i += 2) {
      const px = (pts[i] / 1000) * W - sx, py = (pts[i + 1] / 1000) * H - sy;
      i ? lg.lineTo(px, py) : lg.moveTo(px, py);
    }
    lg.closePath();
    lg.clip();
  }
  lg.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

  // 2. compose on the studio background
  const out = document.createElement('canvas');
  out.width = width; out.height = height;
  const g = out.getContext('2d');
  g.fillStyle = STUDIO_BG; g.fillRect(0, 0, width, height);
  const fit = Math.min((width * 0.8) / sw, (height * 0.8) / sh);
  const dw = sw * fit, dh = sh * fit, dx = (width - dw) / 2, dy = (height - dh) / 2;
  if (pts) {
    g.save();
    g.shadowColor = 'rgba(60, 45, 30, .22)'; g.shadowBlur = 28; g.shadowOffsetY = 14;
    g.drawImage(layer, dx, dy, dw, dh);
    g.restore();
  } else {
    // no outline: a softly rounded crop reads as a product tile rather than a snapshot
    g.save();
    const r = 28;
    g.beginPath();
    g.roundRect ? g.roundRect(dx, dy, dw, dh, r) : g.rect(dx, dy, dw, dh);
    g.shadowColor = 'rgba(60, 45, 30, .18)'; g.shadowBlur = 24; g.shadowOffsetY = 10;
    g.fillStyle = '#fff'; g.fill();
    g.clip();
    g.drawImage(layer, dx, dy, dw, dh);
    g.restore();
  }
  return canvasBlob(out, 0.88);
}
