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

// ---------- clown makeup ----------
const OUTER_LIPS = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146];
const WIG = ["#ff4d6d", "#ffb020", "#3ec6ff", "#7be04d", "#d65cff"];

// Paints a rainbow wig, eye paint, red nose, cheeks and a big smile on every face.
// Draws onto a canvas that already holds the mirrored video.
export function drawClown(canvas, faces) {
  const W = canvas.width;
  const H = canvas.height;
  if (!W || !H) return;
  const ctx = canvas.getContext("2d");
  for (const lm of faces || []) {
    const P = (i) => ({ x: (1 - lm[i].x) * W, y: lm[i].y * H });
    const top = P(10);
    const chin = P(152);
    const left = P(454); // mirrored, so 454 is on the left of the screen
    const right = P(234);
    const faceW = Math.hypot(right.x - left.x, right.y - left.y);
    const faceH = Math.hypot(chin.x - top.x, chin.y - top.y);
    const cx = (left.x + right.x) / 2;
    const cy = (top.y + chin.y) / 2;

    // wig: a ring of puffy circles over the top of the head
    const n = 15;
    for (let k = 0; k < n; k++) {
      const a = Math.PI * (1.02 + (k / (n - 1)) * 0.96);
      const rx = faceW * 0.66;
      const ry = faceH * 0.42;
      const x = cx + Math.cos(a) * rx;
      const y = top.y + faceH * 0.28 + Math.sin(a) * ry;
      ctx.fillStyle = WIG[k % WIG.length];
      ctx.beginPath();
      ctx.arc(x, y, faceW * 0.19, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,.25)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // white eye paint with a colored diamond above each eye
    for (const ids of [LEFT, RIGHT]) {
      const pts = ids.map(P);
      const ex = pts.reduce((a, p) => a + p.x, 0) / pts.length;
      const ey = pts.reduce((a, p) => a + p.y, 0) / pts.length;
      const ew = faceW * 0.17;
      ctx.fillStyle = "rgba(255,255,255,.88)";
      ctx.beginPath();
      ctx.ellipse(ex, ey, ew, ew * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ids === LEFT ? "#2f6bff" : "#a43cff";
      const dy = ey - ew * 0.95;
      ctx.beginPath();
      ctx.moveTo(ex, dy - ew * 0.5);
      ctx.lineTo(ex + ew * 0.35, dy);
      ctx.lineTo(ex, dy + ew * 0.5);
      ctx.lineTo(ex - ew * 0.35, dy);
      ctx.closePath();
      ctx.fill();
    }

    // rosy cheeks
    for (const i of [50, 280]) {
      const c = P(i);
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, faceW * 0.14);
      g.addColorStop(0, "rgba(255,60,80,.55)");
      g.addColorStop(1, "rgba(255,60,80,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(c.x, c.y, faceW * 0.14, 0, Math.PI * 2);
      ctx.fill();
    }

    // big red smile that curls up past the mouth corners
    const lips = OUTER_LIPS.map(P);
    ctx.strokeStyle = "#e11d2e";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = faceW * 0.06;
    ctx.beginPath();
    lips.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.stroke();
    for (const c of [P(61), P(291)]) {
      const dir = c.x < cx ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.quadraticCurveTo(c.x + dir * faceW * 0.06, c.y - faceW * 0.02, c.x + dir * faceW * 0.08, c.y - faceW * 0.1);
      ctx.stroke();
    }

    // red nose with a shine
    const nose = P(1);
    const nr = faceW * 0.12;
    const ng = ctx.createRadialGradient(nose.x - nr * 0.3, nose.y - nr * 0.3, nr * 0.1, nose.x, nose.y, nr);
    ng.addColorStop(0, "#ff7a7a");
    ng.addColorStop(0.45, "#e11d2e");
    ng.addColorStop(1, "#8f0f1a");
    ctx.fillStyle = ng;
    ctx.beginPath();
    ctx.arc(nose.x, nose.y, nr, 0, Math.PI * 2);
    ctx.fill();
  }
}
