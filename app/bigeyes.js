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
      // CPU is slower but works on every phone; the GPU mode can fail silently.
      return await make("CPU");
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

// ---------- apples out of your mouth ----------
// Mouth landmarks: inner lips 13 (top) and 14 (bottom), corners 78 and 308.
export function mouthsFromLandmarks(faces) {
  return (faces || []).map((lm) => {
    const width = Math.hypot(lm[78].x - lm[308].x, lm[78].y - lm[308].y);
    const gap = Math.hypot(lm[13].x - lm[14].x, lm[13].y - lm[14].y);
    return { x: (lm[13].x + lm[14].x) / 2, y: (lm[13].y + lm[14].y) / 2, width, open: gap / (width || 1) > 0.3 };
  });
}

export function newApples() {
  return { list: [], last: 0, carry: 0 };
}

const MAX_APPLES = 60;

// Moves the apples and draws them on top of the canvas.
// `mouths` are in the video's un-mirrored 0-1 coordinates.
export function stepApples(state, canvas, mouths, now) {
  const W = canvas.width;
  const H = canvas.height;
  if (!W || !H) return;
  const dt = Math.min(0.05, state.last ? (now - state.last) / 1000 : 0.016);
  state.last = now;

  for (const m of mouths || []) {
    if (!m.open) continue;
    state.carry += dt * 9; // about 9 apples a second
    while (state.carry >= 1) {
      state.carry -= 1;
      state.list.push({
        x: (1 - m.x) * W + (Math.random() - 0.5) * m.width * W * 0.4,
        y: m.y * H,
        vx: (Math.random() - 0.5) * W * 0.45,
        vy: H * (0.05 + Math.random() * 0.25),
        rot: Math.random() * 6.28,
        vr: (Math.random() - 0.5) * 8,
        size: Math.max(W * 0.05, m.width * W * 0.85),
      });
      if (state.list.length > MAX_APPLES) state.list.shift();
    }
  }

  const ctx = canvas.getContext("2d");
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const a of state.list) {
    a.vy += H * 1.8 * dt;
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    a.rot += a.vr * dt;
    const floor = H - a.size * 0.5;
    if (a.y > floor) {
      a.y = floor;
      a.vy *= -0.45;
      a.vx *= 0.85;
      a.vr *= 0.8;
      if (Math.abs(a.vy) < H * 0.08) a.vy = 0;
    }
    if (a.x < a.size * 0.5 || a.x > W - a.size * 0.5) {
      a.x = Math.min(W - a.size * 0.5, Math.max(a.size * 0.5, a.x));
      a.vx *= -0.6;
    }
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.rot);
    ctx.font = `${Math.round(a.size)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.fillText("🍎", 0, 0);
    ctx.restore();
  }
}
