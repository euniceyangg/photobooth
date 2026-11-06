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
    // Pumpkin-yellow and red color blocks covered in polka dots, in the spirit
    // of Yayoi Kusama's dotted paintings (the pattern is original, not a copy).
    css: "url(#posterize) sepia(1) saturate(3.2) hue-rotate(-12deg) contrast(1.15) brightness(1.05)",
    sat: 1, contrast: 1.1, palette: true, dots: true,
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

  if (f.dots) {
    // A loose grid of dots in different sizes. Dark dots on light areas,
    // cream dots on dark areas, so they always show.
    const step = Math.round(w / 14);
    for (let y = -step; y < h + step; y += step) {
      for (let x = -step; x < w + step; x += step) {
        const cx = x + ((y / step) % 2 ? step / 2 : 0) + (Math.random() - 0.5) * step * 0.18;
        const cy = y + (Math.random() - 0.5) * step * 0.18;
        const px = Math.min(w - 1, Math.max(0, Math.round(cx)));
        const py = Math.min(h - 1, Math.max(0, Math.round(cy)));
        const i = (py * w + px) * 4;
        const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        ctx.fillStyle = lum > 120 ? "rgba(24,20,20,.92)" : "rgba(255,241,208,.92)";
        ctx.beginPath();
        ctx.arc(cx, cy, step * (0.12 + Math.random() * 0.2), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
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
