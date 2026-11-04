// Browser-side photo handling: decode, downscale, crop, and a fast local
// quality check so obviously bad photos are flagged before any upload.

export async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* fall through */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}

const dims = (img: ImageBitmap | HTMLImageElement) => ({ w: 'naturalWidth' in img ? img.naturalWidth : img.width, h: 'naturalHeight' in img ? img.naturalHeight : img.height });

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  return c;
}
const toBlob = (c: HTMLCanvasElement, q = 0.88) => new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('encode failed'))), 'image/jpeg', q));

/** Downscale to `max` px on the long side as JPEG — keeps detail while cutting upload and AI cost. */
export async function compress(file: Blob, max = 1600) {
  const img = await decode(file);
  const { w, h } = dims(img);
  const s = Math.min(1, max / Math.max(w, h));
  const c = canvas(w * s, h * s);
  const g = c.getContext('2d')!;
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, c.width, c.height);
  return { blob: await toBlob(c), width: c.width, height: c.height, quality: localQuality(c) };
}

/** Crop to a Gemini box_2d ([ymin,xmin,ymax,xmax] in 0–1000) with padding, for the grid thumbnail. */
export async function cropThumb(file: Blob, box: number[], max = 640) {
  const img = await decode(file);
  const { w, h } = dims(img);
  let [y0, x0, y1, x1] = box.map(v => Math.min(1000, Math.max(0, v)) / 1000);
  if (x1 - x0 < 0.05 || y1 - y0 < 0.05) [y0, x0, y1, x1] = [0, 0, 1, 1];
  const pad = 0.05;
  [x0, y0, x1, y1] = [Math.max(0, x0 - pad), Math.max(0, y0 - pad), Math.min(1, x1 + pad), Math.min(1, y1 + pad)];
  const sw = (x1 - x0) * w, sh = (y1 - y0) * h, s = Math.min(1, max / Math.max(sw, sh));
  const c = canvas(sw * s, sh * s);
  const g = c.getContext('2d')!;
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, x0 * w, y0 * h, sw, sh, 0, 0, c.width, c.height);
  return toBlob(c, 0.85);
}

/** Sharpness (variance of a Laplacian) and brightness on a 256px greyscale copy. */
export function localQuality(src: HTMLCanvasElement) {
  const s = Math.min(1, 256 / Math.max(src.width, src.height));
  const c = canvas(src.width * s, src.height * s);
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(src, 0, 0, c.width, c.height);
  const { data, width: W, height: H } = g.getImageData(0, 0, c.width, c.height);
  const grey = new Float32Array(W * H);
  let sum = 0;
  for (let i = 0; i < W * H; i++) { const v = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]; grey[i] = v; sum += v; }
  let lapSum = 0, lapSq = 0, n = 0;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    const l = grey[i - W] + grey[i + W] + grey[i - 1] + grey[i + 1] - 4 * grey[i];
    lapSum += l; lapSq += l * l; n++;
  }
  const variance = n ? lapSq / n - (lapSum / n) ** 2 : 0;
  const brightness = sum / (W * H);
  return { blurry: variance < 40, dark: brightness < 55, bright: brightness > 235, sharpness: Math.round(variance), brightness: Math.round(brightness) };
}

/** True when the photo is already a clean product shot (plain, even, light border). */
export async function looksLikeProductShot(file: Blob) {
  const img = await decode(file);
  const { w, h } = dims(img);
  const s = Math.min(1, 200 / Math.max(w, h));
  const c = canvas(w * s, h * s);
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, 0, c.width, c.height);
  const d = g.getImageData(0, 0, c.width, c.height).data, band = Math.max(3, Math.round(Math.min(c.width, c.height) * 0.04));
  const px: number[][] = [];
  for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2)
    if (x < band || y < band || x >= c.width - band || y >= c.height - band) { const i = (y * c.width + x) * 4; px.push([d[i], d[i + 1], d[i + 2]]); }
  const mean = [0, 1, 2].map(k => px.reduce((a, p) => a + p[k], 0) / px.length);
  const spread = Math.sqrt(px.reduce((a, p) => a + (p[0] - mean[0]) ** 2 + (p[1] - mean[1]) ** 2 + (p[2] - mean[2]) ** 2, 0) / px.length);
  return spread < 14 && (mean[0] + mean[1] + mean[2]) / 3 > 150;
}
