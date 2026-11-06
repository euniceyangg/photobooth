// Retro film filters.
// `css` is a quick approximation used for the live preview.
// The other fields are applied pixel by pixel to the saved photos, so the
// result looks the same on every phone (Safari can't use canvas CSS filters).
export const FILTERS = [
  { id: "none", name: "Original", icon: "📷", css: "none" },
  {
    id: "kodak",
    name: "Gold 200",
    icon: "🌅",
    css: "sepia(.22) saturate(1.35) contrast(1.05) brightness(1.06) hue-rotate(-8deg)",
    sat: 1.3, contrast: 1.06, bright: 1.05, sepia: 0.22, tint: [1.06, 1.0, 0.88], lift: 12, grain: 0.05, vignette: 0.25,
  },
  {
    id: "polaroid",
    name: "Polaroid",
    icon: "🖼️",
    css: "saturate(.85) contrast(.92) brightness(1.1) sepia(.12) hue-rotate(8deg)",
    sat: 0.85, contrast: 0.92, bright: 1.08, sepia: 0.12, tint: [0.97, 1.0, 1.06], lift: 26, grain: 0.04, vignette: 0.35,
  },
  {
    id: "noir",
    name: "Noir",
    icon: "🎞️",
    css: "grayscale(1) contrast(1.35) brightness(.95)",
    sat: 0, contrast: 1.3, bright: 0.95, lift: 6, grain: 0.14, vignette: 0.5,
  },
  {
    id: "sepia",
    name: "1920s",
    icon: "🕰️",
    css: "sepia(.95) contrast(1.1) brightness(.98)",
    sat: 0.6, contrast: 1.1, bright: 0.98, sepia: 0.95, lift: 14, grain: 0.1, vignette: 0.55,
  },
  {
    id: "disposable",
    name: "Disposable",
    icon: "💥",
    css: "saturate(1.4) contrast(1.2) brightness(1.1) sepia(.12)",
    sat: 1.4, contrast: 1.2, bright: 1.08, sepia: 0.1, tint: [1.04, 0.98, 0.92], lift: 8, grain: 0.09, vignette: 0.3, leak: true, stamp: true,
  },
  {
    id: "cutout",
    name: "Paper Cutout",
    icon: "✂️",
    // Flat colors with thick black outlines, like a cardboard cut-out cartoon.
    // The live preview shows the flat colors; outlines are added to the saved photo.
    css: "url(#posterize) saturate(1.5) contrast(1.15) brightness(1.05)",
    sat: 1.5, contrast: 1.15, bright: 1.05, posterize: 4, outline: 110,
  },
  {
    id: "kusama",
    name: "Dot Infinity",
    icon: "🔴",
    // Your picture rebuilt out of polka dots on a red field, in the spirit of
    // Yayoi Kusama's dotted paintings (an original pattern, not a copy).
    css: "none",
    mosaic: true,
  },
  {
    id: "thermal",
    name: "Heat Cam",
    icon: "🔥",
    // Heat-vision color map with scanlines, a crosshair and a temperature readout.
    css: "none",
    thermal: true,
  },
  {
    id: "funhouse",
    name: "Funhouse",
    icon: "🫠",
    // A carnival-mirror warp: wobbly waves and a giant bulging middle.
    css: "none",
    warp: true,
  },
  {
    id: "bigeyes",
    name: "Big Eyes",
    icon: "👀",
    // Face detection finds your eyes and blows them up (see bigeyes.js).
    css: "none",
    bigEyes: true,
  },
];

export const getFilter = (id) => FILTERS.find((f) => f.id === id) || FILTERS[0];

const PALETTE = [
  [24, 20, 20], // ink black
  [214, 52, 34], // red
  [248, 190, 30], // pumpkin yellow
  [255, 241, 208], // cream
];

function stampText() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `'${p(d.getFullYear() % 100)}  ${p(d.getMonth() + 1)}  ${p(d.getDate())}`;
}

// Applies a filter to everything already drawn on the canvas.
export function applyFilter(canvas, f) {
  if (!f || f.id === "none") return;
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext("2d");
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const { sat = 1, contrast = 1, bright = 1, sepia = 0, tint = [1, 1, 1], lift = 0, grain = 0 } = f;
  const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i] * bright;
    let g = d[i + 1] * bright;
    let b = d[i + 2] * bright;
    r = (r - 128) * contrast + 128;
    g = (g - 128) * contrast + 128;
    b = (b - 128) * contrast + 128;
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    r = gray + (r - gray) * sat;
    g = gray + (g - gray) * sat;
    b = gray + (b - gray) * sat;
    if (sepia) {
      const sr = 0.393 * r + 0.769 * g + 0.189 * b;
      const sg = 0.349 * r + 0.686 * g + 0.168 * b;
      const sb = 0.272 * r + 0.534 * g + 0.131 * b;
      r = r * (1 - sepia) + sr * sepia;
      g = g * (1 - sepia) + sg * sepia;
      b = b * (1 - sepia) + sb * sepia;
    }
    r *= tint[0];
    g *= tint[1];
    b *= tint[2];
    if (lift) {
      const k = (255 - lift) / 255;
      r = lift + r * k;
      g = lift + g * k;
      b = lift + b * k;
    }
    if (grain) {
      const n = (Math.random() - 0.5) * grain * 255 * 2;
      r += n;
      g += n;
      b += n;
    }
    if (f.palette) {
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      const c = l < 60 ? PALETTE[0] : l < 120 ? PALETTE[1] : l < 185 ? PALETTE[2] : PALETTE[3];
      r = c[0];
      g = c[1];
      b = c[2];
    }
    if (f.posterize) {
      const steps = f.posterize - 1;
      r = Math.round(clamp(r) / 255 * steps) / steps * 255;
      g = Math.round(clamp(g) / 255 * steps) / steps * 255;
      b = Math.round(clamp(b) / 255 * steps) / steps * 255;
    }
    d[i] = clamp(r);
    d[i + 1] = clamp(g);
    d[i + 2] = clamp(b);
  }

  if (f.outline) {
    // Find edges between flat color areas and paint them as thick dark lines.
    const lum = new Float32Array(w * h);
    for (let p = 0, i = 0; p < lum.length; p++, i += 4) lum[p] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const edge = new Uint8Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const p = y * w + x;
        const gx = lum[p - w + 1] + 2 * lum[p + 1] + lum[p + w + 1] - lum[p - w - 1] - 2 * lum[p - 1] - lum[p + w - 1];
        const gy = lum[p + w - 1] + 2 * lum[p + w] + lum[p + w + 1] - lum[p - w - 1] - 2 * lum[p - w] - lum[p - w + 1];
        if (Math.abs(gx) + Math.abs(gy) > f.outline) edge[p] = 1;
      }
    }
    const t = 2; // line thickness
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let hit = false;
        for (let dy = 0; dy <= t && !hit; dy++) {
          for (let dx = 0; dx <= t; dx++) {
            if (y + dy < h && x + dx < w && edge[(y + dy) * w + x + dx]) {
              hit = true;
              break;
            }
          }
        }
        if (hit) {
          const i = (y * w + x) * 4;
          d[i] = 25;
          d[i + 1] = 20;
          d[i + 2] = 18;
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);

  if (f.mosaic) drawMosaic(ctx, d, w, h);
  if (f.thermal) drawThermal(ctx, d, w, h);
  if (f.warp) drawWarp(ctx, d, w, h, Math.random() * 6.28);
  if (f.vignette) {
    const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) / 2);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, `rgba(0,0,0,${f.vignette})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
  if (f.leak) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const leak = ctx.createLinearGradient(0, 0, w * 0.45, 0);
    leak.addColorStop(0, "rgba(255,90,30,.55)");
    leak.addColorStop(1, "rgba(255,90,30,0)");
    ctx.fillStyle = leak;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  if (f.stamp) {
    ctx.save();
    ctx.font = `600 ${Math.round(h * 0.055)}px ui-monospace, Menlo, monospace`;
    ctx.textAlign = "right";
    ctx.fillStyle = "#ff9a3c";
    ctx.shadowColor = "rgba(255,120,0,.8)";
    ctx.shadowBlur = 8;
    ctx.fillText(stampText(), w - w * 0.04, h - h * 0.05);
    ctx.restore();
  }
}

export { stampText };


// Rebuilds the picture out of dots. `d` is RGBA pixel data of size w x h.
// Each dot takes its color and size from the part of the picture it sits on.
export function drawMosaic(ctx, d, w, h) {
  ctx.fillStyle = "#c8281e"; // red field
  ctx.fillRect(0, 0, w, h);
  const step = w / 44;
  const rowH = step * 0.866;
  const at = (x, y) => {
    const px = Math.min(w - 1, Math.max(0, Math.round(x)));
    const py = Math.min(h - 1, Math.max(0, Math.round(y)));
    return (py * w + px) * 4;
  };
  for (let row = 0, y = 0; y < h + step; row++, y += rowH) {
    for (let x = row % 2 ? step / 2 : 0; x < w + step; x += step) {
      // average a small patch under the dot
      let lum = 0;
      const o = step * 0.25;
      for (const [dx, dy] of [[0, 0], [-o, 0], [o, 0], [0, -o], [0, o]]) {
        const i = at(x + dx, y + dy);
        lum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      }
      lum = (lum / 5 - 128) * 1.25 + 128; // a little extra contrast
      const color = lum > 185 ? "#fff1d0" : lum > 130 ? "#f8be1e" : lum > 80 ? "#ef7d24" : "#181414";
      const t = Math.min(1, Math.max(0, lum / 255));
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, step * (0.3 + 0.2 * t), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}


// Heat-vision look: brightness becomes a black > purple > red > orange > yellow > white scale.
const HEAT = [
  [0, [11, 2, 32]],
  [0.25, [75, 10, 140]],
  [0.45, [192, 28, 110]],
  [0.6, [240, 69, 30]],
  [0.78, [255, 163, 25]],
  [0.9, [255, 233, 74]],
  [1, [255, 255, 255]],
];
const LUT = (() => {
  const out = [];
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let k = 1;
    while (k < HEAT.length - 1 && HEAT[k][0] < t) k++;
    const [t0, c0] = HEAT[k - 1];
    const [t1, c1] = HEAT[k];
    const u = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
    out.push(c0.map((v, j) => Math.round(v + (c1[j] - v) * u)));
  }
  return out;
})();

export function drawThermal(ctx, d, w, h) {
  const img = ctx.createImageData(w, h);
  const o = img.data;
  for (let i = 0; i < d.length; i += 4) {
    let l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    l = Math.min(255, Math.max(0, (l - 128) * 1.4 + 128));
    const c = LUT[Math.round(l)];
    o[i] = c[0];
    o[i + 1] = c[1];
    o[i + 2] = c[2];
    o[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // scanlines
  ctx.fillStyle = "rgba(0,0,0,.14)";
  const gap = Math.max(3, Math.round(h / 90));
  for (let y = 0; y < h; y += gap * 2) ctx.fillRect(0, y, w, gap);
  // crosshair brackets
  const cx = w / 2;
  const cy = h / 2;
  const r = h * 0.14;
  const a = r * 0.35;
  ctx.strokeStyle = "rgba(255,255,255,.9)";
  ctx.lineWidth = Math.max(2, w / 300);
  ctx.beginPath();
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    ctx.moveTo(cx + sx * r, cy + sy * (r - a));
    ctx.lineTo(cx + sx * r, cy + sy * r);
    ctx.lineTo(cx + sx * (r - a), cy + sy * r);
  }
  ctx.moveTo(cx - a / 2, cy);
  ctx.lineTo(cx + a / 2, cy);
  ctx.moveTo(cx, cy - a / 2);
  ctx.lineTo(cx, cy + a / 2);
  ctx.stroke();
  // readout
  ctx.fillStyle = "rgba(255,255,255,.95)";
  ctx.font = `700 ${Math.round(w * 0.045)}px ui-monospace, Menlo, monospace`;
  ctx.textAlign = "left";
  ctx.fillText("HEAT CAM", w * 0.04, h * 0.09);
  ctx.textAlign = "right";
  ctx.fillText("36.6°C", w * 0.96, h * 0.95);
}


// Funhouse mirror: wavy ripples plus a bulge in the middle. `t` moves the waves.
export function drawWarp(ctx, d, w, h, t) {
  const img = ctx.createImageData(w, h);
  const o = img.data;
  const R = 1.15;
  for (let y = 0; y < h; y++) {
    const ny = (y / h) * 2 - 1;
    for (let x = 0; x < w; x++) {
      const nx = (x / w) * 2 - 1;
      let dx = nx + 0.06 * Math.sin(ny * 7 + t * 2.1);
      let dy = ny + 0.05 * Math.sin(nx * 6 + t * 1.7);
      const vx = dx;
      const vy = dy + 0.1;
      const r = Math.hypot(vx, vy);
      if (r < R) {
        const s = r / R;
        const k = 0.4 + 0.6 * s * s; // small near the middle = strong magnify
        dx = vx * k;
        dy = vy * k - 0.1;
      }
      const sx = Math.min(w - 1.001, Math.max(0, ((dx + 1) / 2) * w));
      const sy = Math.min(h - 1.001, Math.max(0, ((dy + 1) / 2) * h));
      const x0 = sx | 0;
      const y0 = sy | 0;
      const fx = sx - x0;
      const fy = sy - y0;
      const i00 = (y0 * w + x0) * 4;
      const i10 = i00 + 4;
      const i01 = i00 + w * 4;
      const i11 = i01 + 4;
      const j = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        o[j + c] =
          d[i00 + c] * (1 - fx) * (1 - fy) + d[i10 + c] * fx * (1 - fy) + d[i01 + c] * (1 - fx) * fy + d[i11 + c] * fx * fy;
      }
      o[j + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}
