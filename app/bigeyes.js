// Finds faces with MediaPipe (loaded from a CDN the first time it's needed)
// and draws every frame with the eyes magnified.
const BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
const MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

let landmarkerPromise = null;

export function loadLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const mod = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ `${BASE}/+esm`);
      const vision = await mod.FilesetResolver.forVisionTasks(`${BASE}/wasm`);
      const make = (delegate) =>
        mod.FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL, delegate },
          runningMode: "VIDEO",
          numFaces: 4,
        });
      try {
        return await make("GPU");
      } catch {
        return await make("CPU");
      }
    })().catch((e) => {
      landmarkerPromise = null;
      throw e;
    });
  }
  return landmarkerPromise;
}

// Landmark indexes around each eye (corners and lids).
const LEFT = [33, 133, 159, 145];
const RIGHT = [362, 263, 386, 374];

export function eyesFromLandmarks(faces) {
  const out = [];
  for (const lm of faces || []) {
    for (const ids of [LEFT, RIGHT]) {
      const pts = ids.map((i) => lm[i]);
      const x = pts.reduce((a, p) => a + p.x, 0) / pts.length;
      const y = pts.reduce((a, p) => a + p.y, 0) / pts.length;
      const width = Math.hypot(lm[ids[0]].x - lm[ids[1]].x, lm[ids[0]].y - lm[ids[1]].y);
      out.push({ x, y, width });
    }
  }
  return out;
}

let tmp = null;

// Draws `video` mirrored into `canvas`, then magnifies each eye.
// `eyes` are in the video's own (un-mirrored) 0-1 coordinates.
export function drawBigEyes(canvas, video, eyes, zoom = 2.4) {
  const W = video.videoWidth;
  const H = video.videoHeight;
  if (!W || !H) return;
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.save();
  ctx.translate(W, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, W, H);
  ctx.restore();
  if (!eyes?.length) return;

  if (!tmp) tmp = document.createElement("canvas");
  tmp.width = W;
  tmp.height = H;
  tmp.getContext("2d").drawImage(canvas, 0, 0);

  for (const e of eyes) {
    const cx = (1 - e.x) * W;
    const cy = e.y * H;
    const R = e.width * W * 0.95; // radius of the enlarged eye
    const src = R / zoom;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(tmp, cx - src, cy - src, src * 2, src * 2, cx - R, cy - R, R * 2, R * 2);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(2, R * 0.06);
    ctx.strokeStyle = "rgba(20,12,10,.55)";
    ctx.stroke();
  }
}
