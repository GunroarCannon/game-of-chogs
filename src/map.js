// The Seven Chogdoms: royal-ramble's Voronoi map, repainted as a watercolour sticker slapped on a graffiti wall.
// Wet House washes with pooled edges, a blue sea wash, a few ink doodles (mountains, trees, castles), only the
// seven House names, and the nobles as bobbing sticker pins with explosions going off on their land.
import { generateMap, realmGrowth } from '../shared/mapgen.js';
import { RNG, hashStr } from '../shared/rng.js';
import { HOUSES } from '../shared/game.js';
import { FX_META, fxSheet } from './fx.js';
import { prefs } from './prefs.js';

const INK = '#141014', PAPER = '#f7efdf', SEA = '#d3e6e2';
const WASH = { snark: '#7fa6c9', lambopiss: '#e8423f', targaryeet: '#4a3560', greyjoint: '#f4c430', tyrelly: '#5fbf4a', bagatheon: '#ff9f1c', martelly: '#b06cff' };

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
  // where each House's name and castle go: the province nearest the House's centre of mass
  const seats = provsOf.map(provs => {
    if (!provs.length) return null;
    let x = 0, y = 0, n = 0;
    for (const p of provs) { x += p.center[0] * p.size; y += p.center[1] * p.size; n += p.size; }
    x /= n; y /= n;
    return provs.reduce((b, p) => (Math.hypot(p.center[0] - x, p.center[1] - y) < Math.hypot(b.center[0] - x, b.center[1] - y) ? p : b)).center;
  });
  return { m, houseOf, provsOf, seats };
}

/** Where a noble lives: a province of its House, picked by its key, with a little jitter. */
export function homeOf(realm, key, houseId) {
  const h = Math.max(0, HOUSES.findIndex(x => x.id === houseId));
  const provs = realm.provsOf[h].length ? realm.provsOf[h] : realm.m.provinces;
  const p = provs[hashStr(key) % provs.length];
  const j = hashStr('j' + key);
  return [p.center[0] + ((j % 41) - 20), p.center[1] + (((j >> 8) % 41) - 20)];
}

const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.min(255, Math.round(v * k))); return `#${[n >> 16, (n >> 8) & 255, n & 255].map(v => f(v).toString(16).padStart(2, '0')).join('')}`; };

function paint(realm) {
  const { m, houseOf } = realm;
  const cv = document.createElement('canvas');
  cv.width = m.W; cv.height = m.H;
  const g = cv.getContext('2d');
  const rng = new RNG('paint');
  const vor = m.delaunay.voronoi([0, 0, m.W, m.H]);
  const cellHouse = i => (m.land[i] && m.prov[i] >= 0 ? houseOf[m.prov[i]] : -1);
  g.lineCap = 'round'; g.lineJoin = 'round';

  // paper, then a wet blue sea wash with blooms
  g.fillStyle = PAPER; g.fillRect(0, 0, m.W, m.H);
  for (let k = 0; k < 70; k++) {
    const x = rng.range(0, m.W), y = rng.range(0, m.H), r = rng.range(120, 420);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const c = rng.pick(['#7cc6d8', '#5aa9c9', '#8fd6d0', '#6c9fd6']);
    gr.addColorStop(0, hexA(c, rng.range(.18, .32))); gr.addColorStop(.75, hexA(c, .12)); gr.addColorStop(1, hexA(c, 0));
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  for (const [x0, y0, x1, y1] of [[0, 0, 0, 1], [0, 0, 1, 0], [m.W, 0, -1, 0], [0, m.H, 0, -1]]) { // fade the paper edges into the open sea
    const gr = g.createLinearGradient(x0, y0, x0 + x1 * 160, y0 + y1 * 160);
    gr.addColorStop(0, SEA); gr.addColorStop(1, 'rgba(211,230,226,0)');
    g.fillStyle = gr; g.fillRect(0, 0, m.W, m.H);
  }

  // edges between cells: coast and House borders, each remembered per House for the pooled rims
  const coast = [], hb = [], rims = HOUSES.map(() => []);
  const { triangles, halfedges } = m.delaunay, cc = vor.circumcenters;
  for (let e = 0; e < halfedges.length; e++) {
    const j = halfedges[e];
    if (j < e) continue;
    const a = triangles[e], b = triangles[e % 3 === 2 ? e - 2 : e + 1];
    const t1 = Math.floor(e / 3), t2 = Math.floor(j / 3);
    const seg = [cc[2 * t1], cc[2 * t1 + 1], cc[2 * t2], cc[2 * t2 + 1], a, b];
    const ha = cellHouse(a), hb2 = cellHouse(b);
    if (ha === hb2) continue;
    if (m.land[a] !== m.land[b]) coast.push(seg); else hb.push(seg);
    if (ha >= 0) rims[ha].push(seg);
    if (hb2 >= 0) rims[hb2].push(seg);
  }
  const wobble = (list, w, c, jit = 1.6) => {
    g.strokeStyle = c; g.lineWidth = w; g.beginPath();
    for (const s of list) { g.moveTo(s[0] + rng.range(-jit, jit), s[1] + rng.range(-jit, jit)); g.lineTo(s[2] + rng.range(-jit, jit), s[3] + rng.range(-jit, jit)); }
    g.stroke();
  };

  // the sticker cut around the land, under the paint
  wobble(coast, 34, '#fffdf7', 0);
  wobble(coast, 8, INK, 1);

  // House washes: a few loose passes of thin paint, then pooled dark rims, blooms and granulation
  const paths = HOUSES.map(() => new Path2D());
  for (let i = 0; i < m.n; i++) {
    const h = cellHouse(i); if (h < 0) continue;
    const poly = vor.cellPolygon(i); if (!poly) continue;
    const P = paths[h]; P.moveTo(poly[0][0], poly[0][1]); for (const p of poly) P.lineTo(p[0], p[1]); P.closePath();
  }
  HOUSES.forEach((H, h) => {
    const col = WASH[H.id] || H.color, P = paths[h];
    g.save(); g.clip(P);
    g.fillStyle = hexA(col, .5); g.fill(P);
    for (let k = 0; k < 4; k++) { g.save(); g.translate(rng.range(-9, 9), rng.range(-9, 9)); g.fillStyle = hexA(col, .14); g.fill(P); g.restore(); }
    for (let k = 0; k < 16; k++) { // blooms: lighter puddles and darker wet spots
      const [x, y] = rng.pick(realm.provsOf[h].length ? realm.provsOf[h] : m.provinces).center, r = rng.range(40, 140);
      const gr = g.createRadialGradient(x + rng.range(-60, 60), y + rng.range(-60, 60), 0, x, y, r), light = rng.chance(.55);
      gr.addColorStop(0, light ? 'rgba(255,253,247,.32)' : hexA(shade(col, .7), .28)); gr.addColorStop(.8, light ? 'rgba(255,253,247,.06)' : hexA(shade(col, .7), .12)); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - r * 1.5, y - r * 1.5, r * 3, r * 3);
    }
    wobble(rims[h], 22, hexA(shade(col, .62), .22), 3);
    wobble(rims[h], 8, hexA(shade(col, .55), .4), 2);
    g.restore();
  });
  for (let k = 0; k < 12000; k++) { // granulation over everything
    const x = rng.range(0, m.W), y = rng.range(0, m.H);
    g.fillStyle = rng.chance(.5) ? 'rgba(20,16,20,.07)' : 'rgba(255,255,255,.12)';
    g.fillRect(x, y, rng.range(1, 3), rng.range(1, 3));
  }

  // ink: hand-drawn House borders and coast
  g.setLineDash([14, 10]); wobble(hb, 3.5, hexA(INK, .75), 1.2); g.setLineDash([]);
  wobble(coast, 4.5, INK, 1.2);

  // paint drips off the southern coasts
  for (const s of coast) {
    const [x1, y1, x2, y2, a, b] = s;
    const landAbove = m.land[a] ? m.pts[2 * a + 1] < m.pts[2 * b + 1] : m.pts[2 * b + 1] < m.pts[2 * a + 1];
    if (!landAbove || !rng.chance(0.07)) continue;
    const x = (x1 + x2) / 2, y = (y1 + y2) / 2 + 4, len = rng.range(14, 54), w = rng.range(5, 9);
    const H = HOUSES[cellHouse(m.land[a] ? a : b)];
    g.fillStyle = hexA(WASH[H?.id] || '#888', .8); g.strokeStyle = INK; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x - w / 2, y + len); g.arc(x, y + len, w / 2, Math.PI, 0, true); g.lineTo(x + w / 2, y); g.closePath(); g.fill(); g.stroke();
  }
  // splatter in the sea near the coast
  for (let k = 0; k < 26; k++) {
    const s = rng.pick(coast), x = s[0] + rng.range(-70, 70), y = s[1] + rng.range(-70, 70);
    const i = m.delaunay.find(x, y); if (m.land[i]) continue;
    const c = rng.pick(['#ff2e88', '#ffe14d', '#836ef9', '#2de2e6']);
    g.fillStyle = hexA(c, .55);
    for (let d = 0; d < 7; d++) { g.beginPath(); g.arc(x + rng.range(-16, 16), y + rng.range(-16, 16), rng.range(1.5, 6), 0, 7); g.fill(); }
  }

  // a few ink doodles: mountains on the highest ground, trees in the wet lowlands, waves at sea
  const placed = [];
  const free = (x, y, d) => placed.every(([px, py]) => Math.hypot(px - x, py - y) > d) && realm.seats.every(s => !s || Math.hypot(s[0] - x, s[1] - y) > 120);
  const order = [...Array(m.n).keys()].filter(i => m.land[i]).sort((a, b) => m.elev[b] - m.elev[a]);
  let mounts = 0;
  for (const i of order) {
    if (mounts >= 26) break;
    const x = m.pts[2 * i], y = m.pts[2 * i + 1];
    if (!free(x, y, 90)) continue;
    placed.push([x, y]); mounts++;
    for (const [dx, sc] of [[-16, .75], [12, 1], [34, .6]]) {
      const w = 34 * sc, h = 40 * sc, bx = x + dx, by = y + 14;
      g.fillStyle = 'rgba(80,70,90,.35)'; g.strokeStyle = INK; g.lineWidth = 3;
      g.beginPath(); g.moveTo(bx - w / 2, by); g.lineTo(bx + rng.range(-3, 3), by - h); g.lineTo(bx + w / 2, by); g.fill(); g.stroke();
      g.fillStyle = '#fffdf7'; g.beginPath(); g.moveTo(bx - w * .16, by - h * .68); g.lineTo(bx, by - h); g.lineTo(bx + w * .16, by - h * .68); g.lineTo(bx + w * .05, by - h * .6); g.closePath(); g.fill(); g.stroke();
    }
  }
  let trees = 0;
  for (const i of [...order].sort((a, b) => m.wet[b] - m.wet[a])) {
    if (trees >= 30) break;
    const x = m.pts[2 * i], y = m.pts[2 * i + 1];
    if (m.elev[i] > .42 || !free(x, y, 80)) continue;
    placed.push([x, y]); trees++;
    for (const [dx, dy] of [[-12, 4], [10, -2], [0, 12]]) {
      const tx = x + dx, ty = y + dy;
      g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx, ty + 12); g.stroke();
      g.fillStyle = 'rgba(40,120,50,.55)'; g.beginPath(); g.arc(tx, ty - 4, 10, 0, 7); g.fill(); g.stroke();
    }
  }
  g.strokeStyle = hexA(INK, .55); g.lineWidth = 3;
  for (let k = 0; k < 40; k++) {
    const x = rng.range(30, m.W - 30), y = rng.range(30, m.H - 30), i = m.delaunay.find(x, y);
    if (m.land[i] || !free(x, y, 70)) continue;
    placed.push([x, y]);
    g.beginPath(); g.moveTo(x - 18, y); g.quadraticCurveTo(x - 9, y - 9, x, y); g.quadraticCurveTo(x + 9, y + 9, x + 18, y); g.stroke();
  }
  // a castle doodle at every House seat (the name is drawn live on top)
  realm.seats.forEach((s, h) => {
    if (!s) return;
    const [x, y] = s, col = WASH[HOUSES[h].id];
    g.save(); g.translate(x, y + 30); g.strokeStyle = INK; g.lineWidth = 3.5; g.fillStyle = '#fffdf7';
    const tower = (tx, w, h2) => { g.beginPath(); g.rect(tx - w / 2, -h2, w, h2); g.fill(); g.stroke(); for (let c = 0; c < 3; c++) { g.beginPath(); g.rect(tx - w / 2 + c * w / 3 + 1, -h2 - 7, w / 3 - 3, 7); g.fill(); g.stroke(); } };
    tower(-26, 22, 46); tower(26, 22, 46); tower(0, 34, 62);
    g.fillStyle = INK; g.beginPath(); g.arc(0, -10, 7, Math.PI, 0); g.lineTo(7, 0); g.lineTo(-7, 0); g.fill();
    g.fillStyle = col; g.beginPath(); g.moveTo(0, -69); g.lineTo(0, -92); g.lineTo(20, -86); g.lineTo(0, -80); g.fill(); g.stroke();
    g.restore();
  });
  return cv;
}

export class ChogMap {
  constructor(canvas, realm, { onPickHouse, onPickPin } = {}) {
    Object.assign(this, { canvas, realm, onPickHouse, onPickPin, pins: [], pulses: [], fx: [], marks: [], imgs: new Map(), hops: new Map() });
    this.bg = paint(realm);
    this.ctx = canvas.getContext('2d');
    this.view = { x: realm.m.W / 2, y: realm.m.H / 2, z: 0.5 };
    this.bind();
    new ResizeObserver(() => this.fit()).observe(canvas);
    this.fit();
    document.fonts?.load('900 40px "Cinzel Decorative"').then(() => this.draw()).catch(() => {});
    const tick = t => { // pins bob and labels sway, at about 30 fps while the map is on screen
      if (!this.canvas.isConnected) return;
      requestAnimationFrame(tick);
      if (document.hidden || !this.canvas.offsetParent || t - (this.last || 0) < 32) return;
      if (prefs.shake || this.fx.length || this.pulses.length || this.hops.size) { this.last = t; this.render(t); }
    };
    requestAnimationFrame(tick);
  }
  fit() {
    const r = this.canvas.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
    if (!r.width) return;
    this.canvas.width = r.width * d; this.canvas.height = r.height * d; this.dpr = d;
    if (!this.fitted) { // landscape: the whole realm; portrait phones: fill the height and let them pan
      const fx = r.width / this.realm.m.W, fy = r.height / this.realm.m.H;
      this.view.z = r.width < r.height ? fy * 0.9 : Math.min(fx, fy) * 1.04; this.fitted = true;
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
      if (moved < 8 && e.type === 'pointerup') this.click(e.clientX, e.clientY);
    };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
  }
  pinScale() { return 1 / Math.max(0.55, Math.min(1.4, this.view.z)); }
  click(cx, cy) {
    const [x, y] = this.toWorld(cx, cy), s = this.pinScale();
    const pin = [...this.pins].reverse().find(p => Math.hypot(p.x - x, p.y - y) < ((p.r || 24) + 10) * s);
    if (pin) { this.hop(pin.key); return this.onPickPin?.(pin); }
    const i = this.realm.m.delaunay.find(x, y);
    if (this.realm.m.land[i]) this.onPickHouse?.(HOUSES[this.realm.houseOf[this.realm.m.prov[i]]]);
  }
  img(src) {
    if (!this.imgs.has(src)) { const im = new Image(); im.onload = () => this.draw(); im.src = src; this.imgs.set(src, im); }
    return this.imgs.get(src);
  }
  setPins(pins) {
    const old = new Set(this.pins.map(p => p.key));
    for (const p of pins) if (!old.has(p.key)) this.hops.set(p.key, performance.now() + Math.random() * 400);
    this.pins = pins; this.draw();
  }
  hop(key) { this.hops.set(key, performance.now()); this.draw(); }
  /** Something happened at (x, y): an effect on the land and the pin there jumps. kind: stab | love | crown | duel. */
  pulse(x, y, color = '#ff3b3b', kind = 'stab', key) {
    const now = performance.now();
    this.pulses.push({ x, y, color, t: now });
    const add = (name, size, d = 0) => this.fx.push({ name, x: x + (Math.random() - .5) * 20, y: y + (Math.random() - .5) * 20, size, t: now + d });
    if (kind === 'stab') { add('boom', 150); add('blood', 110, 120); this.marks.push({ x, y, t: now, rot: Math.random() * 6 }); }
    else if (kind === 'duel') { add('hit', 130); add('pow', 90, 80); }
    else if (kind === 'love') { add('bubble', 60); add('bubble', 46, 150); }
    else add('pow', 100);
    if (key) this.hop(key);
    this.draw();
  }
  draw() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(t => { this.raf = 0; this.render(t); });
  }
  render(t = performance.now()) {
    const { ctx: g, canvas: c, view: v, dpr } = this;
    const W = c.width / dpr, H = c.height / dpr;
    const wob = prefs.shake ? 1 : 0;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = SEA; g.fillRect(0, 0, W, H); // the sea runs on past the edge of the painting
    g.save(); g.translate(W / 2, H / 2); g.scale(v.z, v.z); g.translate(-v.x, -v.y);
    g.drawImage(this.bg, 0, 0);
    this.marks = this.marks.filter(mk => t - mk.t < 30000);
    FX_META.then(meta => (this.meta = meta));
    for (const mk of this.marks) { // scorch marks linger where the blood was spilled
      const im = fxSheet('scorch1'); if (!im.complete) continue;
      g.save(); g.globalAlpha = .7 * (1 - (t - mk.t) / 30000); g.translate(mk.x, mk.y); g.rotate(mk.rot); g.drawImage(im, -55, -55, 110, 110); g.restore();
    }
    this.pulses = this.pulses.filter(p => t - p.t < 1600);
    for (const p of this.pulses) {
      const k = (t - p.t) / 1600;
      g.strokeStyle = p.color; g.globalAlpha = 1 - k; g.lineWidth = 8 / Math.max(.4, v.z);
      g.beginPath(); g.arc(p.x, p.y, 20 + k * 90, 0, 7); g.stroke(); g.globalAlpha = 1;
    }
    // House names: readable at any zoom, swaying a little
    const ls = Math.min(2.2, 1 / Math.max(.45, v.z));
    g.textAlign = 'center'; g.textBaseline = 'middle';
    this.realm.seats.forEach((s, h) => {
      if (!s) return;
      const name = HOUSES[h].name.toUpperCase(), sway = wob * Math.sin(t / 900 + h) * .03;
      g.save(); g.translate(s[0], s[1] - 62); g.rotate(-.05 + sway); g.scale(ls * .62, ls * .62);
      g.font = '900 46px "Cinzel Decorative", Cinzel, Georgia, serif';
      g.lineWidth = 12; g.strokeStyle = INK; g.strokeText(name, 4, 5); g.strokeText(name, 0, 0);
      g.fillStyle = '#fffdf7'; g.fillText(name, 0, 0);
      g.restore();
    });
    // pins: sticker portraits that bob, and hop when something happens to them
    const s = this.pinScale();
    for (const p of this.pins) {
      let r = (p.r || 24) * s, dy = wob * Math.sin(t / 420 + (p.x % 17)) * 3 * s, sx = 1, sy = 1;
      const h0 = this.hops.get(p.key);
      if (h0 !== undefined) {
        const k = (t - h0) / 600;
        if (k > 1) this.hops.delete(p.key);
        else if (k > 0) { dy -= Math.sin(k * Math.PI) * 34 * s; const sq = Math.sin(k * Math.PI * 3) * (1 - k) * .22; sx = 1 + sq; sy = 1 - sq; }
      }
      const im = this.img(p.src);
      g.save(); g.translate(p.x, p.y + dy); g.scale(sx, sy); g.rotate(wob * Math.sin(t / 700 + p.y) * .06);
      g.fillStyle = 'rgba(20,16,20,.35)'; g.beginPath(); g.ellipse(0, r + 8 * s - dy, r * .8, r * .25, 0, 0, 7); g.fill();
      if (p.glow) { g.shadowColor = p.glow; g.shadowBlur = 22; }
      g.fillStyle = p.ring || '#fff8ec'; g.beginPath(); g.arc(0, 0, r + 5 * s, 0, 7); g.fill();
      g.shadowBlur = 0; g.lineWidth = 4 * s; g.strokeStyle = INK; g.stroke();
      g.save(); g.beginPath(); g.arc(0, 0, r, 0, 7); g.clip();
      g.fillStyle = '#e9e1d2'; g.fill();
      if (im.complete && im.naturalWidth) g.drawImage(im, -r, -r, r * 2, r * 2);
      g.restore();
      if (p.badge) { g.font = `${Math.round(22 * s)}px sans-serif`; g.textAlign = 'center'; g.fillText(p.badge, 0, -r - 8 * s); }
      if (p.label) {
        g.font = `700 ${Math.round(14 * s)}px Fredoka, sans-serif`; g.textAlign = 'center';
        g.lineWidth = 5 * s; g.strokeStyle = INK; g.strokeText(p.label, 0, r + 20 * s); g.fillStyle = p.labelColor || '#fff8ec'; g.fillText(p.label, 0, r + 20 * s);
      }
      g.restore();
    }
    // sprite effects on the land
    this.fx = this.fx.filter(f => {
      const meta = this.meta?.[f.name]; if (!meta) return t - f.t < 3000;
      const k = Math.floor((t - f.t) / 1000 * 18);
      if (k < 0) return true;
      if (k >= meta.n) return false;
      const im = fxSheet(f.name); if (!im.complete) return true;
      const sz = f.size * s, hgt = sz * meta.h / meta.w;
      g.drawImage(im, k * meta.w, 0, meta.w, meta.h, f.x - sz / 2, f.y - hgt / 2, sz, hgt);
      return true;
    });
    g.restore();
  }
}
