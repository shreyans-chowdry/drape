// On-device clothing segmentation with Google's MediaPipe multiclass model.
// It labels every pixel as background, hair, skin or clothes, so a shirt worn
// by a person comes out without arms, neck or scenery. Free, runs on the phone,
// and the photo never leaves it. The model (~16 MB) downloads once, then the
// browser caches it.

const VISION = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite';
const CLOTHES = 4; // 0 background, 1 hair, 2 body skin, 3 face skin, 4 clothes, 5 others

let ready = null;
function segmenter() {
  ready ||= (async () => {
    const { FilesetResolver, ImageSegmenter } = await import(`${VISION}/vision_bundle.mjs`);
    const files = await FilesetResolver.forVisionTasks(`${VISION}/wasm`);
    return ImageSegmenter.createFromOptions(files, {
      baseOptions: { modelAssetPath: MODEL },
      runningMode: 'IMAGE', outputCategoryMask: false, outputConfidenceMasks: true,
    });
  })().catch(err => { ready = null; throw err; });
  return ready;
}

/**
 * Soft alpha mask (0–255, one byte per pixel) of the clothing in `canvas`,
 * at the canvas's own size. Returns null if the model can't load or finds
 * almost no clothing (e.g. a flat-lay on a bed, where "clothes" is ambiguous).
 */
export async function clothesMask(canvas) {
  let seg;
  try { seg = await segmenter(); } catch { return null; }
  let conf, mw, mh;
  const res = seg.segment(canvas);
  try {
    const m = res.confidenceMasks[CLOTHES];
    mw = m.width; mh = m.height;
    conf = m.getAsFloat32Array().slice();
  } finally { res.close?.(); }

  const W = canvas.width, H = canvas.height, out = new Uint8ClampedArray(W * H);
  let covered = 0;
  for (let y = 0; y < H; y++) {
    const my = Math.min(mh - 1, Math.floor((y * mh) / H));
    for (let x = 0; x < W; x++) {
      const c = conf[my * mw + Math.min(mw - 1, Math.floor((x * mw) / W))];
      const a = Math.max(0, Math.min(1, (c - 0.35) / 0.3)); // soft edge between 35% and 65% confidence
      out[y * W + x] = a * 255;
      if (a > 0.5) covered++;
    }
  }
  return covered / (W * H) > 0.04 ? out : null;
}
