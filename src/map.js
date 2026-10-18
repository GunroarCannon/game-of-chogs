// The Seven Chogdoms: royal-ramble's Voronoi map, repainted as a piece sprayed on a brick wall. Sticker-cut
// coasts, paint drips, House territories in their colours and tag-style labels. Pins show nobles on their land.
import { Delaunay } from 'd3-delaunay';
import { generateMap, realmGrowth } from '../shared/mapgen.js';
import { RNG, hashStr } from '../shared/rng.js';
import { HOUSES } from '../shared/game.js';

const INK = '#141014';

export function buildRealm(seed = 'chogdoms-1') {
  const m = generateMap(seed, { spacing: 24, provinceSpacing: 110 });
  const { owner } = realmGrowth(m, new RNG('houses:' + seed), HOUSES.length);
  // the seven big realms are the Houses; small leftover counties join their nearest House
  const houseOf = new Int32Array(m.provinces.length);
  for (const p of m.provinces) houseOf[p.id] = owner[p.id] < HOUSES.length ? owner[p.id] : -1;
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of m.provinces) if (houseOf[p.id] < 0) {
      const nb = p.neighbors.find(j => houseOf[j] >= 0);
      if (nb !== undefined) { houseOf[p.id] = houseOf[nb]; changed = true; }
    }
  }
  for (const p of m.provinces) if (houseOf[p.id] < 0) houseOf[p.id] = p.id % HOUSES.length;
  const provsOf = HOUSES.map((_, h) => m.provinces.filter(p => houseOf[p.id] === h));
  return { m, houseOf, provsOf };
}

/** Where a noble lives: a province of its House, picked by its key, with a little jitter. */
export function homeOf(realm, key, houseId) {
  const h = Math.max(0, HOUSES.findIndex(x => x.id === houseId));
  const provs = realm.provsOf[h].length ? realm.provsOf[h] : realm.m.provinces;
  const p = provs[hashStr(key) % provs.length];
  const j = hashStr('j' + key);
  return [p.center[0] + ((j % 41) - 20), p.center[1] + (((j >> 8) % 41) - 20)];
}

function paint(realm) {
  const { m, houseOf } = realm;
  const cv = document.createElement('canvas');
  cv.width = m.W; cv.height = m.H;
  const g = cv.getContext('2d');
  const rng = new RNG('paint');
  const vor = m.delaunay.voronoi([0, 0, m.W, m.H]);
  const cellHouse = i => (m.prov[i] >= 0 ? houseOf[m.prov[i]] : -1);

  // the wall: bricks
  g.fillStyle = '#231d2b'; g.fillRect(0, 0, m.W, m.H);
  g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 3;
  for (let y = 0, r = 0; y < m.H; y += 46, r++) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(m.W, y); g.stroke();
    for (let x = (r % 2) * 55; x < m.W; x += 110) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 46); g.stroke(); }
  }
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(255,255,255,${rng.range(0.01, 0.05)})`; g.fillRect(rng.range(0, m.W), rng.range(0, m.H), rng.range(2, 9), rng.range(2, 5)); }

  // edges between cells, sorted into coast / house border / province border
  const coast = [], hb = [], pb = [];
  const { triangles, halfedges } = m.delaunay, cc = vor.circumcenters;
  for (let e = 0; e < halfedges.length; e++) {
    const j = halfedges[e];
    if (j < e) continue;
    const a = triangles[e], b = triangles[e % 3 === 2 ? e - 2 : e + 1];
    const t1 = Math.floor(e / 3), t2 = Math.floor(j / 3);
    const seg = [cc[2 * t1], cc[2 * t1 + 1], cc[2 * t2], cc[2 * t2 + 1], a, b];
    if (m.land[a] !== m.land[b]) coast.push(seg);
    else if (m.land[a] && cellHouse(a) !== cellHouse(b)) hb.push(seg);
    else if (m.land[a] && m.prov[a] !== m.prov[b]) pb.push(seg);
  }
  const stroke = (list, w, c) => { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); for (const s of list) { g.moveTo(s[0], s[1]); g.lineTo(s[2], s[3]); } g.stroke(); };
  g.lineCap = 'round'; g.lineJoin = 'round';

  // sticker cut: a fat white outline, then black, then the paint
  stroke(coast, 30, '#fff8ec');
  stroke(coast, 14, INK);
  for (let i = 0; i < m.n; i++) {
    if (!m.land[i]) continue;
    const poly = vor.cellPolygon(i);
    if (!poly) continue;
    g.fillStyle = HOUSES[cellHouse(i)]?.color || '#888';
    g.beginPath(); g.moveTo(poly[0][0], poly[0][1]); for (const p of poly) g.lineTo(p[0], p[1]); g.closePath(); g.fill();
    g.strokeStyle = g.fillStyle; g.lineWidth = 1.5; g.stroke();
  }
  // spray texture: speckles and soft highlights inside the land
  for (let k = 0; k < 9000; k++) {
    const x = rng.range(0, m.W), y = rng.range(0, m.H), i = m.delaunay.find(x, y);
    if (!m.land[i]) continue;
    g.fillStyle = rng.chance(0.5) ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.12)';
    g.beginPath(); g.arc(x, y, rng.range(0.8, 2.6), 0, 7); g.fill();
  }
  for (let k = 0; k < 120; k++) {
    const x = rng.range(0, m.W), y = rng.range(0, m.H), i = m.delaunay.find(x, y);
    if (!m.land[i]) continue;
    const gr = g.createRadialGradient(x, y, 0, x, y, 70);
    gr.addColorStop(0, 'rgba(255,255,255,.16)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(x - 70, y - 70, 140, 140);
  }
  stroke(pb, 2.5, 'rgba(20,16,20,.32)');
  g.setLineDash([2, 16]); stroke(hb, 9, INK); g.setLineDash([]);
  stroke(hb, 3, INK);
  stroke(coast, 6, INK);

  // drips: paint running down off the southern coasts
  for (const s of coast) {
    const [x1, y1, x2, y2, a, b] = s;
    const landAbove = m.land[a] ? m.pts[2 * a + 1] < m.pts[2 * b + 1] : m.pts[2 * b + 1] < m.pts[2 * a + 1];
    if (!landAbove || !rng.chance(0.09)) continue;
    const x = (x1 + x2) / 2, y = (y1 + y2) / 2 + 4, len = rng.range(14, 60), w = rng.range(4, 8);
    g.fillStyle = HOUSES[cellHouse(m.land[a] ? a : b)]?.color || '#888';
    g.strokeStyle = INK; g.lineWidth = 3;
    g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x - w / 2, y + len); g.arc(x, y + len, w / 2, Math.PI, 0, true); g.lineTo(x + w / 2, y); g.closePath(); g.fill(); g.stroke();
  }

  // province names, then the big House tags
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const p of m.provinces) {
    if (p.size < 14) continue;
    g.font = '15px Under, Impact, sans-serif';
    g.lineWidth = 4; g.strokeStyle = 'rgba(255,248,236,.85)'; g.strokeText(p.name.toUpperCase(), p.center[0], p.center[1] + 26);
    g.fillStyle = INK; g.fillText(p.name.toUpperCase(), p.center[0], p.center[1] + 26);
  }
  HOUSES.forEach((h, hi) => {
    const provs = realm.provsOf[hi];
    if (!provs.length) return;
    let x = 0, y = 0, n = 0;
    for (const p of provs) { x += p.center[0] * p.size; y += p.center[1] * p.size; n += p.size; }
    x /= n; y /= n;
    const best = provs.reduce((b, p) => (Math.hypot(p.center[0] - x, p.center[1] - y) < Math.hypot(b.center[0] - x, b.center[1] - y) ? p : b));
    realm.labels = realm.labels || [];
    realm.labels[hi] = best.center;
    g.save(); g.translate(best.center[0], best.center[1] - 20); g.rotate(rng.range(-0.12, 0.08));
    g.font = '58px Tag, Impact, sans-serif';
    g.lineWidth = 16; g.strokeStyle = INK; g.strokeText(h.name.toUpperCase(), 0, 0);
    g.lineWidth = 6; g.strokeStyle = '#fff8ec'; g.strokeText(h.name.toUpperCase(), 0, 0);
    g.fillStyle = h.color === '#2b2233' ? '#e8423f' : h.color; g.fillText(h.name.toUpperCase(), 0, 0);
    g.restore();
  });
  return cv;
}

export class ChogMap {
  constructor(canvas, realm, { onPickHouse, onPickPin } = {}) {
    Object.assign(this, { canvas, realm, onPickHouse, onPickPin, pins: [], pulses: [], imgs: new Map() });
    this.bg = paint(realm);
    this.ctx = canvas.getContext('2d');
    this.view = { x: realm.m.W / 2, y: realm.m.H / 2, z: 0.5 };
    this.bind();
    new ResizeObserver(() => this.fit()).observe(canvas);
    this.fit();
  }
  fit() {
    const r = this.canvas.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
    if (!r.width) return;
    this.canvas.width = r.width * d; this.canvas.height = r.height * d; this.dpr = d;
    if (!this.fitted) { // landscape: the whole realm; portrait phones: fill the height and let them pan
      const fx = r.width / this.realm.m.W, fy = r.height / this.realm.m.H;
      this.view.z = r.width < r.height ? fy * 0.82 : Math.min(fx, fy) * 1.08; this.fitted = true;
    }
    this.draw();
  }
  toWorld(cx, cy) { const r = this.canvas.getBoundingClientRect(); return [(cx - r.left - r.width / 2) / this.view.z + this.view.x, (cy - r.top - r.height / 2) / this.view.z + this.view.y]; }
  toScreen(x, y) { const r = this.canvas.getBoundingClientRect(); return [(x - this.view.x) * this.view.z + r.width / 2 + r.left, (y - this.view.y) * this.view.z + r.height / 2 + r.top]; }
  zoom(f, cx, cy) {
    const r = this.canvas.getBoundingClientRect();
    cx ??= r.left + r.width / 2; cy ??= r.top + r.height / 2;
    const [wx, wy] = this.toWorld(cx, cy);
    const min = Math.min(r.width / this.realm.m.W, r.height / this.realm.m.H) * 0.9;
    this.view.z = Math.min(3, Math.max(min, this.view.z * f));
    const [nx, ny] = this.toWorld(cx, cy);
    this.view.x += wx - nx; this.view.y += wy - ny;
    this.draw();
  }
  focus(x, y, z) { this.view.x = x; this.view.y = y; if (z) this.view.z = z; this.draw(); }
  bind() {
    const c = this.canvas, pts = new Map();
    let moved = 0, pinch = 0;
    c.addEventListener('wheel', e => { e.preventDefault(); this.zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY); }, { passive: false });
    c.addEventListener('pointerdown', e => { c.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; c.classList.add('drag'); });
    c.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      const [px, py] = pts.get(e.pointerId);
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2) {
        const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (pinch) this.zoom(d / pinch, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        pinch = d; moved += 10; return;
      }
      moved += Math.abs(e.clientX - px) + Math.abs(e.clientY - py);
      this.view.x -= (e.clientX - px) / this.view.z; this.view.y -= (e.clientY - py) / this.view.z;
      this.draw();
    });
    const up = e => {
      pts.delete(e.pointerId); pinch = 0; c.classList.remove('drag');
      if (moved < 6 && e.type === 'pointerup') this.click(e.clientX, e.clientY);
    };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
  }
  click(cx, cy) {
    const [x, y] = this.toWorld(cx, cy);
    const pin = [...this.pins].reverse().find(p => Math.hypot(p.x - x, p.y - y) < (p.r || 26) / Math.min(1, this.view.z) * 0.9);
    if (pin) return this.onPickPin?.(pin);
    const i = this.realm.m.delaunay.find(x, y);
    if (this.realm.m.land[i]) this.onPickHouse?.(HOUSES[this.realm.houseOf[this.realm.m.prov[i]]]);
  }
  img(src) {
    if (!this.imgs.has(src)) { const im = new Image(); im.onload = () => this.draw(); im.src = src; this.imgs.set(src, im); }
    return this.imgs.get(src);
  }
  setPins(pins) { this.pins = pins; this.draw(); }
  pulse(x, y, color = '#ff3b3b') {
    this.pulses.push({ x, y, color, t: performance.now() });
    if (!this.animating) { this.animating = true; const step = () => { this.draw(); if (this.pulses.length) requestAnimationFrame(step); else this.animating = false; }; requestAnimationFrame(step); }
  }
  draw() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => { this.raf = 0; this.render(); });
  }
  render() {
    const { ctx: g, canvas: c, view: v, dpr } = this;
    const W = c.width / dpr, H = c.height / dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#17131c'; g.fillRect(0, 0, W, H);
    g.save(); g.translate(W / 2, H / 2); g.scale(v.z, v.z); g.translate(-v.x, -v.y);
    g.drawImage(this.bg, 0, 0);
    const now = performance.now();
    this.pulses = this.pulses.filter(p => now - p.t < 1600);
    for (const p of this.pulses) {
      const k = (now - p.t) / 1600;
      g.strokeStyle = p.color; g.globalAlpha = 1 - k; g.lineWidth = 8 / Math.max(.4, v.z);
      g.beginPath(); g.arc(p.x, p.y, 20 + k * 90, 0, 7); g.stroke(); g.globalAlpha = 1;
    }
    const s = 1 / Math.max(0.55, Math.min(1.4, v.z)); // pins keep a readable size at any zoom
    for (const p of this.pins) {
      const r = (p.r || 24) * s, im = this.img(p.src);
      g.save(); g.translate(p.x, p.y);
      if (p.glow) { g.shadowColor = p.glow; g.shadowBlur = 24; }
      g.fillStyle = p.ring || '#fff8ec'; g.beginPath(); g.arc(0, 0, r + 5 * s, 0, 7); g.fill();
      g.shadowBlur = 0; g.lineWidth = 4 * s; g.strokeStyle = INK; g.stroke();
      g.save(); g.beginPath(); g.arc(0, 0, r, 0, 7); g.clip();
      if (im.complete && im.naturalWidth) g.drawImage(im, -r, -r, r * 2, r * 2); else { g.fillStyle = '#ddd'; g.fill(); }
      g.restore();
      if (p.badge) { g.font = `${Math.round(22 * s)}px sans-serif`; g.textAlign = 'center'; g.fillText(p.badge, 0, -r - 6 * s); }
      if (p.label) {
        g.font = `${Math.round(13 * s)}px Under, Impact, sans-serif`; g.textAlign = 'center';
        g.lineWidth = 4 * s; g.strokeStyle = INK; g.strokeText(p.label, 0, r + 18 * s); g.fillStyle = p.labelColor || '#fff8ec'; g.fillText(p.label, 0, r + 18 * s);
      }
      g.restore();
    }
    g.restore();
  }
}
