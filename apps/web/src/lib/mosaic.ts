/**
 * Pointer mosaic, contained in the Field lens.
 * Distance → tile scale. Live ticks call pulseField().
 */
import gsap from "gsap";
import { prefersReducedMotion } from "./gsap/init";

const CHAIN = [
  "#627eea",
  "#0052ff",
  "#28a0f0",
  "#ff0420",
  "#04795b",
  "#e84142",
  "#8247e5",
  "#61dfff",
  "#c9b800",
  "#5b5cd6",
  "#ff6b35",
  "#9945ff",
];

const CW = 900;
const BOX = 72;

const m = { x: CW / 2, y: CW / 2, s: 1.2, x2: CW / 2, y2: CW / 2 };
const spread = { extra: 0 };

export function pulseField() {
  gsap.fromTo(spread, { extra: 1.1 }, { extra: 0, duration: 0.7, ease: "expo.out" });
}

function paintSource(): HTMLCanvasElement {
  const src = document.createElement("canvas");
  src.width = src.height = CW;
  const g = src.getContext("2d")!;
  g.fillStyle = "#121410";
  g.fillRect(0, 0, CW, CW);

  for (let i = 0; i < 36; i++) {
    g.fillStyle = CHAIN[i % CHAIN.length];
    g.globalAlpha = 0.22 + (i % 5) * 0.05;
    const s = 70 + ((i * 41) % 200);
    g.fillRect((i * 157) % CW, (i * 211) % CW, s, s * 0.7);
  }
  g.globalAlpha = 1;
  return src;
}

export function initMosaic(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = canvas.height = CW;
  const src = paintSource();
  const reduced = prefersReducedMotion();

  type Cell = { x: number; y: number; d: number; s: number };
  const boxes: Cell[] = [];
  for (let x = 0; x <= CW; x += BOX) {
    for (let y = 0; y <= CW; y += BOX) {
      boxes.push({ x, y, d: 0, s: 0 });
    }
  }

  const xTo = gsap.quickTo(m, "x", { duration: 0.85, ease: "expo.out" });
  const yTo = gsap.quickTo(m, "y", { duration: 0.85, ease: "expo.out" });
  const sTo = gsap.quickTo(m, "s", { duration: 1.2, ease: "power2.out" });
  const TAU = Math.PI * 2;
  ctx.fillStyle = "#f1ead8";

  function draw() {
    const d = Math.hypot(m.x - m.x2, m.y - m.y2);
    sTo((d / CW) * 1.6 + 0.55 + spread.extra);
    ctx.clearRect(0, 0, CW, CW);
    ctx.drawImage(src, 0, 0);
    for (const c of boxes) {
      c.d = Math.hypot(c.x - m.x, c.y - m.y);
      c.s = 1 - gsap.utils.clamp(0, 1, c.d / CW / m.s);
      if (c.s < 0.002) continue;
      const scaled = BOX * c.s;
      ctx.drawImage(src, c.x + scaled / 2, c.y + scaled / 2, BOX - scaled, BOX - scaled, c.x, c.y, BOX, BOX);
    }
    for (const c of boxes) {
      if (c.s < 0.04) continue;
      ctx.beginPath();
      ctx.arc(c.x, c.y, BOX * 0.1 * c.s, 0, TAU);
      ctx.fill();
    }
  }

  if (reduced) {
    ctx.drawImage(src, 0, 0);
    return;
  }

  gsap.ticker.add(draw);

  const host = canvas.parentElement ?? canvas;
  host.addEventListener(
    "pointermove",
    (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      if (r.width === 0) return;
      const sx = CW / r.width;
      const sy = CW / r.height;
      m.x2 = (e.clientX - r.left) * sx;
      m.y2 = (e.clientY - r.top) * sy;
      xTo(m.x2);
      yTo(m.y2);
    },
    { passive: true }
  );
}
