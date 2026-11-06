"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FILTERS, getFilter, applyFilter, drawMosaic, drawThermal, drawWarp, stampText } from "./filters";
import { loadLandmarker, eyesFromLandmarks, drawBigEyes, mouthsFromLandmarks, newApples, stepApples } from "./bigeyes";

const SHOTS = 4;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Cell size and spacing of the photo strip, in pixels.
const CELL_W = 800;
const CELL_H = 600;
const BORDER = 48;
const GAP = 32;
const FOOTER = 120;

function grabFrame(video, filter, eyesCanvas) {
  // For Big Eyes the picture is already mirrored and processed on eyesCanvas.
  const processed = (filter.bigEyes || filter.apples) && eyesCanvas && eyesCanvas.width > 0;
  const src = processed ? eyesCanvas : video;
  const vw = processed ? eyesCanvas.width : video.videoWidth;
  const vh = processed ? eyesCanvas.height : video.videoHeight;
  const target = CELL_W / CELL_H;
  let sw = vw;
  let sh = vw / target;
  if (sh > vh) {
    sh = vh;
    sw = vh * target;
  }
  const c = document.createElement("canvas");
  c.width = CELL_W;
  c.height = CELL_H;
  const ctx = c.getContext("2d");
  if (!processed) {
    ctx.translate(CELL_W, 0);
    ctx.scale(-1, 1); // mirror to match the preview
  }
  ctx.drawImage(src, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, CELL_W, CELL_H);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  applyFilter(c, filter);
  return c;
}

function buildStrip(frames) {
  const w = CELL_W + BORDER * 2;
  const h = BORDER + frames.length * CELL_H + (frames.length - 1) * GAP + FOOTER;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  frames.forEach((f, i) => ctx.drawImage(f, BORDER, BORDER + i * (CELL_H + GAP)));
  ctx.fillStyle = "#111";
  ctx.textAlign = "center";
  ctx.font = "600 40px ui-rounded, -apple-system, system-ui, sans-serif";
  const date = new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  ctx.fillText(date, w / 2, h - FOOTER / 2 + 10);
  return c;
}

const toBlob = (canvas) => new Promise((res) => canvas.toBlob(res, "image/png"));

export default function Home() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const mosaicRef = useRef(null);
  const eyesCanvasRef = useRef(null);
  const eyesRef = useRef([]);
  const mouthsRef = useRef([]);
  const applesRef = useRef(newApples());
  const [eyesStatus, setEyesStatus] = useState("idle"); // idle | loading | ready | error
  const [phase, setPhase] = useState("loading"); // loading | ready | shooting | result | denied | unsupported
  const [count, setCount] = useState(null);
  const [taken, setTaken] = useState(0);
  const [flashKey, setFlashKey] = useState(0);
  const [strip, setStrip] = useState(null); // { url, blob }
  const [filterId, setFilterId] = useState("none");
  const filter = getFilter(filterId);

  // Big Eyes: load the face finder the first time that filter is picked.
  useEffect(() => {
    if (!(filter.bigEyes || filter.apples) || eyesStatus !== "idle") return;
    setEyesStatus("loading");
    loadLandmarker().then(
      () => setEyesStatus("ready"),
      () => {
        setEyesStatus("error");
        setFilterId("none");
      }
    );
  }, [filter.bigEyes, filter.apples, eyesStatus]);

  // Draw the live dot picture while Dot Infinity is on.
  useEffect(() => {
    if (!(filter.mosaic || filter.thermal || filter.warp) || (phase !== "ready" && phase !== "shooting")) return;
    let raf;
    let stopped = false;
    const small = document.createElement("canvas");
    small.width = 320;
    small.height = 240;
    const sctx = small.getContext("2d", { willReadFrequently: true });
    const tick = () => {
      if (stopped) return;
      const video = videoRef.current;
      const canvas = mosaicRef.current;
      if (video && canvas && video.readyState >= 2 && video.videoWidth) {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        let sw = vw;
        let sh = (vw * 3) / 4;
        if (sh > vh) {
          sh = vh;
          sw = (vh * 4) / 3;
        }
        sctx.save();
        sctx.translate(320, 0);
        sctx.scale(-1, 1);
        sctx.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, 320, 240);
        sctx.restore();
        const data = sctx.getImageData(0, 0, 320, 240).data;
        if (canvas.width !== 320) {
          canvas.width = 320;
          canvas.height = 240;
        }
        const g = canvas.getContext("2d");
        if (filter.warp) drawWarp(g, data, 320, 240, performance.now() / 1000);
        else (filter.thermal ? drawThermal : drawMosaic)(g, data, 320, 240);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [filter.mosaic, filter.thermal, filter.warp, phase]);

  // Draw the live Big Eyes picture while that filter is on.
  useEffect(() => {
    if (!(filter.bigEyes || filter.apples) || eyesStatus !== "ready" || (phase !== "ready" && phase !== "shooting")) return;
    let raf;
    let last = -1;
    let stopped = false;
    const tick = async () => {
      if (stopped) return;
      const video = videoRef.current;
      const canvas = eyesCanvasRef.current;
      if (video && canvas && video.readyState >= 2 && video.videoWidth) {
        if (video.currentTime !== last) {
          last = video.currentTime;
          try {
            const lm = await loadLandmarker();
            const res = lm.detectForVideo(video, performance.now());
            eyesRef.current = eyesFromLandmarks(res.faceLandmarks);
            mouthsRef.current = mouthsFromLandmarks(res.faceLandmarks);
          } catch {}
        }
        drawBigEyes(canvas, video, filter.bigEyes ? eyesRef.current : []);
        if (filter.apples) stepApples(applesRef.current, canvas, mouthsRef.current, performance.now());
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [filter.bigEyes, filter.apples, eyesStatus, phase]);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPhase("unsupported");
      return;
    }
    setPhase("loading");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      setPhase("ready");
    } catch (err) {
      setPhase(err?.name === "NotAllowedError" || err?.name === "SecurityError" ? "denied" : "unsupported");
    }
  }, []);

  // Attach the stream whenever the camera view is on screen.
  useEffect(() => {
    const v = videoRef.current;
    if ((phase === "ready" || phase === "shooting") && v && streamRef.current && v.srcObject !== streamRef.current) {
      v.srcObject = streamRef.current;
      v.play().catch(() => {});
    }
  }, [phase]);

  useEffect(() => {
    startCamera();
    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, [startCamera]);

  // Phones stop the camera when you switch apps; restart when you come back.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const live = streamRef.current?.getTracks().some((t) => t.readyState === "live");
      if (!live && (phase === "ready" || phase === "loading")) startCamera();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [phase, startCamera]);

  const shoot = async () => {
    const video = videoRef.current;
    if (!video || phase !== "ready") return;
    setPhase("shooting");
    setTaken(0);
    const frames = [];
    for (let n = 3; n >= 1; n--) {
      setCount(n);
      await wait(1000);
    }
    for (let i = 0; i < SHOTS; i++) {
      setCount(null);
      setFlashKey((k) => k + 1);
      frames.push(grabFrame(video, filter, eyesCanvasRef.current));
      setTaken(i + 1);
      if (i < SHOTS - 1) {
        await wait(1200);
      }
    }
    const blob = await toBlob(buildStrip(frames));
    setStrip({ blob, url: URL.createObjectURL(blob) });
    await wait(400);
    setPhase("result");
  };

  const retake = () => {
    if (strip) URL.revokeObjectURL(strip.url);
    setStrip(null);
    setTaken(0);
    setCount(null);
    const live = streamRef.current?.getTracks().some((t) => t.readyState === "live");
    if (live) setPhase("ready");
    else startCamera();
  };

  const save = async () => {
    if (!strip) return;
    const file = new File([strip.blob], `photo-strip-${Date.now()}.png`, { type: "image/png" });
    // On phones this opens the share sheet, where "Save Image" puts it in Photos.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch (e) {
        if (e?.name === "AbortError") return;
      }
    }
    const a = document.createElement("a");
    a.href = strip.url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <main className="app">
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <filter id="posterize" colorInterpolationFilters="sRGB">
          <feComponentTransfer>
            <feFuncR type="discrete" tableValues="0 .33 .67 1" />
            <feFuncG type="discrete" tableValues="0 .33 .67 1" />
            <feFuncB type="discrete" tableValues="0 .33 .67 1" />
          </feComponentTransfer>
        </filter>
      </svg>
      {(phase === "ready" || phase === "shooting" || phase === "loading") && (
        <>
          <div className="stage">
            <video ref={videoRef} className="video" style={{ filter: filter.css }} playsInline muted autoPlay />
            {(filter.bigEyes || filter.apples) && eyesStatus === "ready" && <canvas ref={eyesCanvasRef} className="video eyes" />}
            {(filter.bigEyes || filter.apples) && eyesStatus === "loading" && <div className="loadnote">Loading face magic…</div>}
            {filter.hint && eyesStatus === "ready" && phase === "ready" && <div className="loadnote">{filter.hint}</div>}
            {(filter.mosaic || filter.thermal || filter.warp) && <canvas ref={mosaicRef} className="video eyes" />}
            {filter.vignette && <div className="ov vig" style={{ opacity: Math.min(1, filter.vignette * 1.6) }} />}
            {filter.grain && <div className="ov grain" style={{ opacity: Math.min(0.5, filter.grain * 4) }} />}
            {filter.leak && <div className="ov leak" />}
            {filter.stamp && <div className="stamp">{stampText()}</div>}
            <div className="top">
              {Array.from({ length: SHOTS }).map((_, i) => (
                <span key={i} className={`dot ${i < taken ? "on" : ""}`} />
              ))}
            </div>
            {count && (
              <div className="count" key={count}>
                {count}
              </div>
            )}
            {flashKey > 0 && <div className="flash go" key={flashKey} />}
          </div>
          <div className="filters">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                className={`chip ${f.id === filterId ? "on" : ""}`}
                onClick={() => setFilterId(f.id)}
                disabled={phase === "shooting"}
              >
                <span className="chip-icon">{f.icon}</span>
                {f.name}
              </button>
            ))}
          </div>
          <div className="bar">
            <button className="shutter" onClick={shoot} disabled={phase !== "ready"} aria-label="Take photos" />
          </div>
        </>
      )}

      {phase === "result" && strip && (
        <div className="result">
          <div className="strip-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="strip" src={strip.url} alt="Your photo strip" />
          </div>
          <div className="actions">
            <button className="btn" onClick={save}>Save</button>
            <button className="btn ghost" onClick={retake}>Retake</button>
          </div>
        </div>
      )}

      {phase === "denied" && (
        <div className="msg">
          <h1>We need your camera 📷</h1>
          <p>
            The booth can&rsquo;t see you yet. On iPhone, open Settings, find this app (or Safari), tap Camera
            and choose Allow. On Android, tap the lock icon next to the address, then Permissions, then Camera.
            Then come back and try again.
          </p>
          <button className="btn" onClick={startCamera}>Try again</button>
        </div>
      )}

      {phase === "unsupported" && (
        <div className="msg">
          <h1>No camera found</h1>
          <p>
            This browser can&rsquo;t open a camera here. Make sure no other app is using it, and open the page in
            Safari or Chrome over a secure (https) link.
          </p>
          <button className="btn" onClick={startCamera}>Try again</button>
        </div>
      )}
    </main>
  );
}
