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

/**
 * True when the photo already looks like a shop listing: the edges are one
 * plain, even colour (a studio sweep or a flat white/grey backdrop). Those
 * photos are kept exactly as they are instead of being cut out again.
 */
export function isProductShot(img) {
  const c = drawTo(img, 200), { width: w, height: h } = c;
  const d = c.getContext('2d').getImageData(0, 0, w, h).data;
  const band = Math.max(3, Math.round(Math.min(w, h) * 0.04)), px = [];
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
    if (x < band || y < band || x >= w - band || y >= h - band) {
      const i = (y * w + x) * 4;
      px.push([d[i], d[i + 1], d[i + 2]]);
    }
  }
  const mean = [0, 1, 2].map(k => px.reduce((a, p) => a + p[k], 0) / px.length);
  const spread = Math.sqrt(px.reduce((a, p) => a + (p[0] - mean[0]) ** 2 + (p[1] - mean[1]) ** 2 + (p[2] - mean[2]) ** 2, 0) / px.length);
  const light = (mean[0] + mean[1] + mean[2]) / 3;
  return spread < 14 && light > 150;
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

/** Turn a byte mask from segment.js into a canvas whose alpha is the mask. */
export function maskCanvas(mask, w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const d = new ImageData(w, h);
  for (let i = 0; i < mask.length; i++) d.data[i * 4 + 3] = mask[i];
  c.getContext('2d').putImageData(d, 0, 0);
  return c;
}

/** Bounding box of the visible pixels on a canvas, or null if it's empty. */
function opaqueBox(c) {
  const { width: w, height: h } = c, a = c.getContext('2d').getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
    if (a[(y * w + x) * 4 + 3] > 100) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 2, h: y1 - y0 + 2 };
}

/**
 * Build a shop-style image on-device: isolate the garment, centre it on a
 * studio background with a soft shadow. Best: the pixel mask from segment.js
 * (`mask` is a canvas whose alpha covers the clothing in the whole photo).
 * Next best: Gemini's outline polygon. Last resort: a rounded crop.
 */
export async function cutout(img, garment, { width = 900, height = 1200, mask = null } = {}) {
  const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
  let [y0, x0, y1, x1] = (garment.box_2d || [0, 0, 1000, 1000]).map(v => Math.min(1000, Math.max(0, v)) / 1000);
  if (x1 - x0 < 0.05 || y1 - y0 < 0.05) [y0, x0, y1, x1] = [0, 0, 1, 1];
  // a little slack around the box so sleeves and hems aren't clipped
  const pad = 0.03;
  [x0, y0, x1, y1] = [Math.max(0, x0 - pad), Math.max(0, y0 - pad), Math.min(1, x1 + pad), Math.min(1, y1 + pad)];
  const pts = Array.isArray(garment.outline) && garment.outline.length >= 12 && garment.outline.length % 2 === 0 ? garment.outline : null;

  // 1. the garment on a transparent layer, at source resolution
  const sx = x0 * W, sy = y0 * H, sw = (x1 - x0) * W, sh = (y1 - y0) * H;
  const scale = Math.min(1, 1600 / Math.max(sw, sh));
  let layer = document.createElement('canvas');
  layer.width = Math.max(1, Math.round(sw * scale)); layer.height = Math.max(1, Math.round(sh * scale));
  const lg = layer.getContext('2d');
  lg.drawImage(img, sx, sy, sw, sh, 0, 0, layer.width, layer.height);

  let isolated = false;
  if (mask) {
    lg.globalCompositeOperation = 'destination-in';
    lg.drawImage(mask, x0 * mask.width, y0 * mask.height, (x1 - x0) * mask.width, (y1 - y0) * mask.height, 0, 0, layer.width, layer.height);
    lg.globalCompositeOperation = 'source-over';
    const box = opaqueBox(layer);
    // trust the mask only if it found a real garment-sized area inside the box
    if (box && box.w * box.h > layer.width * layer.height * 0.15) {
      const t = document.createElement('canvas');
      t.width = box.w; t.height = box.h;
      t.getContext('2d').drawImage(layer, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
      layer = t; isolated = true;
    } else {
      lg.clearRect(0, 0, layer.width, layer.height);
      lg.drawImage(img, sx, sy, sw, sh, 0, 0, layer.width, layer.height);
    }
  }
  if (!isolated && pts) {
    const clip = document.createElement('canvas');
    clip.width = layer.width; clip.height = layer.height;
    const cg = clip.getContext('2d');
    cg.beginPath();
    for (let i = 0; i < pts.length; i += 2) {
      const px = ((pts[i] / 1000) * W - sx) * scale, py = ((pts[i + 1] / 1000) * H - sy) * scale;
      i ? cg.lineTo(px, py) : cg.moveTo(px, py);
    }
    cg.closePath(); cg.clip();
    cg.drawImage(layer, 0, 0);
    layer = clip; isolated = true;
  }

  // 2. compose on the studio background
  const out = document.createElement('canvas');
  out.width = width; out.height = height;
  const g = out.getContext('2d');
  g.fillStyle = STUDIO_BG; g.fillRect(0, 0, width, height);
  const lw = layer.width, lh = layer.height;
  const fit = Math.min((width * 0.82) / lw, (height * 0.82) / lh);
  const dw = lw * fit, dh = lh * fit, dx = (width - dw) / 2, dy = (height - dh) / 2;
  g.imageSmoothingQuality = 'high';
  if (isolated) {
    g.save();
    g.shadowColor = 'rgba(60, 45, 30, .22)'; g.shadowBlur = 28; g.shadowOffsetY = 14;
    g.drawImage(layer, dx, dy, dw, dh);
    g.restore();
  } else {
    // nothing to isolate with: a softly rounded crop reads as a product tile rather than a snapshot
    g.save();
    g.beginPath();
    g.roundRect ? g.roundRect(dx, dy, dw, dh, 28) : g.rect(dx, dy, dw, dh);
    g.shadowColor = 'rgba(60, 45, 30, .18)'; g.shadowBlur = 24; g.shadowOffsetY = 10;
    g.fillStyle = '#fff'; g.fill();
    g.clip();
    g.drawImage(layer, dx, dy, dw, dh);
    g.restore();
  }
  return canvasBlob(out, 0.9);
}
