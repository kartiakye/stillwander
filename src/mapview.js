// The map: the whole island, drawn from the same data the world is built from.
// Press N (or the map button) to open it; N or Esc closes it.
import { engine } from './engine.js';
import * as MAP from './map.js';

const STEP = 4;                                  // tiles per pixel of the base picture
const { x0, x1, z0, z1 } = MAP.BOUNDS;
const W = Math.ceil((x1 - x0) / STEP), H = Math.ceil((z1 - z0) / STEP);
const LAND_NAMES = ['Pampas Plain', 'Golden Wood', 'Bamboo Hollow', 'Snow Crest', 'Heron Marsh', 'Crimson Vale', 'Blossom Field'];
const INK = '#2b2550', PAPER = '#fbf3e4';

// ---- the base picture, painted a few rows at a time so play never stutters
const base = document.createElement('canvas');
base.width = W; base.height = H;
const bctx = base.getContext('2d');
const img = bctx.createImageData(W, H);
const heights = new Float32Array(W * H);
let row = 0;
function paintRows(n) {
  for (let k = 0; k < n && row < H; k++, row++) {
    for (let i = 0; i < W; i++) {
      const x = x0 + i * STEP + STEP / 2, z = z0 + row * STEP + STEP / 2;
      const s = engine.survey(Math.floor(x), Math.floor(z));
      heights[row * W + i] = s.h;
      let c;
      if (s.h <= -2) c = [0.55, 0.76, 0.80];
      else if (s.h < 0) c = [0.62, 0.85, 0.84];
      else {
        const t = engine.B[s.b].top;
        const up = row > 0 ? heights[(row - 1) * W + i] : s.h, left = i > 0 ? heights[row * W + i - 1] : s.h;
        const shade = 0.92 + Math.min(0.12, s.h * 0.012) + Math.max(-0.12, Math.min(0.12, (s.h - (up + left) / 2) * 0.06));
        c = t.map(v => v * shade);
        if (s.h > 9) c = c.map(v => v + (1 - v) * Math.min(0.6, (s.h - 9) * 0.12));   // snow on the heights
      }
      const o = (row * W + i) * 4;
      img.data[o] = c[0] * 255; img.data[o + 1] = c[1] * 255; img.data[o + 2] = c[2] * 255; img.data[o + 3] = 255;
    }
  }
  if (row >= H) bctx.putImageData(img, 0, 0);
}
function idle() { if (row < H) { if (engine.started) paintRows(3); requestAnimationFrame(idle); } }
requestAnimationFrame(idle);

// ---- the overlay
const wrap = document.createElement('div');
wrap.id = 'mapv';
wrap.hidden = true;
wrap.innerHTML = '<canvas aria-label="Map of the island"></canvas><p class="mapkey">N or Esc to close</p>';
document.body.appendChild(wrap);
const style = document.createElement('style');
style.textContent = `#mapv{position:fixed;inset:0;background:rgba(43,37,80,.55);display:flex;align-items:center;justify-content:center;z-index:20;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
#mapv canvas{max-width:calc(100vw - 32px);max-height:calc(100vh - 64px);border-radius:18px;box-shadow:0 20px 60px rgba(43,37,80,.45);background:${PAPER}}
#mapv .mapkey{position:absolute;bottom:14px;left:0;right:0;text-align:center;margin:0;color:${PAPER};font:300 .68rem var(--ui);letter-spacing:.24em;text-transform:uppercase;opacity:.85}`;
document.head.appendChild(style);
const cv = wrap.querySelector('canvas');

export function toggleMap(force) {
  const open = force === undefined ? wrap.hidden : force;
  wrap.hidden = !open;
  if (open) { if (row < H) paintRows(H); draw(); }
}
export const mapOpen = () => !wrap.hidden;
wrap.addEventListener('pointerdown', () => toggleMap(false));

function draw() {
  const scale = Math.min((innerWidth - 32) / W, (innerHeight - 64) / H) * (devicePixelRatio || 1);
  const pad = 26 * (devicePixelRatio || 1);
  cv.width = Math.round(W * scale + pad * 2); cv.height = Math.round(H * scale + pad * 2);
  const c = cv.getContext('2d'), k = scale / STEP, dpr = devicePixelRatio || 1;
  const X = x => pad + (x - x0) * k, Z = z => pad + (z - z0) * k;
  c.fillStyle = PAPER; c.fillRect(0, 0, cv.width, cv.height);
  c.imageSmoothingEnabled = true;
  c.drawImage(base, pad, pad, W * scale, H * scale);

  // forests: a stipple of small dark crowns
  c.fillStyle = 'rgba(43,37,80,.16)';
  for (const f of MAP.FORESTS) for (let i = 0; i < f.r * 0.9; i++) {
    const a = i * 2.39996, d = Math.sqrt(i / (f.r * 0.9)) * f.r * 0.92;
    c.beginPath(); c.arc(X(f.x + Math.cos(a) * d), Z(f.z + Math.sin(a) * d), 1.7 * dpr, 0, 7); c.fill();
  }
  // rivers
  c.strokeStyle = '#7fc3cf'; c.lineCap = c.lineJoin = 'round';
  for (const r of MAP.RIVERS) for (let i = 0; i < r.path.length - 1; i++) {
    const [ax, az, aw] = r.path[i], [bx, bz] = r.path[i + 1];
    c.lineWidth = Math.max(1.5 * dpr, aw * 2 * k); c.beginPath(); c.moveTo(X(ax), Z(az)); c.lineTo(X(bx), Z(bz)); c.stroke();
  }
  // roads
  c.setLineDash([5 * dpr, 4 * dpr]); c.lineWidth = 1.6 * dpr; c.strokeStyle = 'rgba(43,37,80,.55)';
  for (const p of MAP.ROADS) { c.beginPath(); p.forEach(([x, z], i) => i ? c.lineTo(X(x), Z(z)) : c.moveTo(X(x), Z(z))); c.stroke(); }
  c.setLineDash([]);

  // land names
  c.textAlign = 'center'; c.textBaseline = 'middle';
  for (const r of MAP.REGIONS) {
    const [cx, cz] = r.label || [r.at.reduce((s, p) => s + p[0], 0) / r.at.length, r.at.reduce((s, p) => s + p[1], 0) / r.at.length];
    c.font = `italic 300 ${Math.round(17 * dpr)}px "Cormorant Garamond", Georgia, serif`;
    c.fillStyle = 'rgba(43,37,80,.78)';
    c.fillText(LAND_NAMES[r.land].toUpperCase().split('').join(' '), X(cx), Z(cz) - 18 * dpr);
  }
  // landmarks
  for (const l of MAP.LANDMARKS) {
    c.fillStyle = INK; c.beginPath(); c.arc(X(l.x), Z(l.z), 2.6 * dpr, 0, 7); c.fill();
    c.font = `italic 400 ${Math.round(11 * dpr)}px "Cormorant Garamond", Georgia, serif`;
    c.fillStyle = 'rgba(43,37,80,.9)'; c.fillText(l.name, X(l.x), Z(l.z) + 10 * dpr);
  }
  // shrines: gold when awake
  for (const s of MAP.SHRINES) {
    const key = Math.floor(s.x / engine.RS) + ',' + Math.floor(s.z / engine.RS), lit = engine.awake.has(key), r = (s.main ? 6 : 4) * dpr;
    c.save(); c.translate(X(s.x), Z(s.z)); c.rotate(Math.PI / 4);
    c.fillStyle = lit ? '#f6c453' : PAPER; c.strokeStyle = INK; c.lineWidth = 1.3 * dpr;
    c.fillRect(-r / 2, -r / 2, r, r); c.strokeRect(-r / 2, -r / 2, r, r); c.restore();
  }
  // you are here
  const P = engine.P, f = engine.P.face;
  c.save(); c.translate(X(P.x), Z(P.z)); c.rotate(Math.atan2(Math.cos(f), Math.sin(f)) - Math.PI / 2);
  c.fillStyle = '#e0483a'; c.strokeStyle = PAPER; c.lineWidth = 2 * dpr;
  c.beginPath(); c.moveTo(0, -9 * dpr); c.lineTo(6 * dpr, 7 * dpr); c.lineTo(0, 3 * dpr); c.lineTo(-6 * dpr, 7 * dpr); c.closePath(); c.stroke(); c.fill();
  c.restore();
  // title and compass
  c.font = `300 ${Math.round(24 * dpr)}px "Cormorant Garamond", Georgia, serif`; c.fillStyle = INK; c.textAlign = 'left';
  c.fillText('S T I L L W A N D E R', pad + 8 * dpr, pad + 22 * dpr);
  c.font = `400 ${Math.round(11 * dpr)}px "Jost", sans-serif`; c.textAlign = 'center';
  c.fillText('N', cv.width - pad - 18 * dpr, pad + 14 * dpr);
  c.beginPath(); c.moveTo(cv.width - pad - 18 * dpr, pad + 22 * dpr); c.lineTo(cv.width - pad - 18 * dpr, pad + 48 * dpr); c.strokeStyle = INK; c.lineWidth = 1.2 * dpr; c.stroke();
}
addEventListener('resize', () => { if (!wrap.hidden) draw(); });
