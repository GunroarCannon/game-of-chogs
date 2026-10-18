// Comic explosions: one canvas over everything for sprite-sheet effects (public/fx, built by scripts/build-fx.py),
// particles and debris, plus the screen juice: shake, hit-freeze, flash, bounce, wiggle and fly-off-screen.
import { prefs } from './prefs.js';

let cv, g, parts = [], anims = [], running = false, frozenUntil = 0;
const SHEET = {};
export const FX_META = fetch('/fx/fx.json').then(r => r.json()).catch(() => ({}));

function ensure() {
  if (cv) return;
  cv = document.createElement('canvas'); cv.id = 'fx';
  document.body.appendChild(cv); g = cv.getContext('2d');
  const fit = () => { const d = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * d; cv.height = innerHeight * d; g.setTransform(d, 0, 0, d, 0, 0); };
  fit(); addEventListener('resize', fit);
}
export function fxSheet(name) {
  if (!SHEET[name]) { const im = new Image(); im.src = `/fx/${name}.webp`; SHEET[name] = im; }
  return SHEET[name];
}
/** Warm the image cache so the first stab is not a blank frame. */
export function preloadFx() { for (const n of ['boom', 'hit', 'hit2', 'pow', 'blood', 'squirt', 'drops', 'chomp', 'bubble', 'fire', 'scorch1', 'stain']) fxSheet(n); }
const COLORS = ['#ffe14d', '#ff2e88', '#ff3b3b', '#ff9f1c', '#fff8ec', '#836ef9', '#2de2e6'];
const rnd = (a, b) => a + Math.random() * (b - a);

/** Play a sprite strip at (x, y). size is the drawn width in CSS px. */
export async function sprite(name, x, y, { size = 160, fps = 22, rot = 0, flip = false, delay = 0, hold = 0 } = {}) {
  ensure();
  const meta = (await FX_META)[name]; if (!meta) return;
  anims.push({ im: fxSheet(name), meta, x, y, size, fps, rot, flip, t0: performance.now() + delay, hold });
  start();
}

/** Particles. kind: 'boom' (fire + debris), 'confetti', 'gas' (green fart cloud), 'blood', 'hearts'. */
export function burst(x, y, kind = 'boom', power = 1) {
  ensure();
  const n = Math.round((kind === 'confetti' ? 90 : kind === 'hearts' ? 26 : 60) * power);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = (kind === 'gas' ? 2 : kind === 'hearts' ? 4 : 7) * power * (0.3 + Math.random());
    const p = { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (kind === 'confetti' || kind === 'hearts' ? 4 : 1.5), life: 1, decay: 0.012 + Math.random() * 0.02, r: 3 + Math.random() * 9 * power, kind, spin: rnd(-6, 6), rot: Math.random() * 6 };
    p.c = kind === 'gas' ? `rgba(${120 + Math.random() * 60},${200 + Math.random() * 40},${60 + Math.random() * 40},` : kind === 'blood' ? (Math.random() < .7 ? '#e0102e' : '#8a0a1e') : kind === 'hearts' ? (Math.random() < .6 ? '#ff2e88' : '#ff7ab8') : COLORS[Math.floor(Math.random() * COLORS.length)];
    if (kind === 'gas') { p.vx *= .6; p.vy = -0.6 - Math.random(); p.r *= 2.2; p.decay *= .6; }
    if (kind === 'hearts') { p.r = 10 + Math.random() * 10; p.decay *= .8; }
    parts.push(p);
  }
  if (kind === 'boom') for (let i = 0; i < 3; i++) parts.push({ x, y, ring: true, r: 10, vr: 9 + i * 4, life: 1, decay: 0.035 + i * 0.01, c: i ? '#ff2e88' : '#ffe14d' });
  start();
}

function start() { if (!running) { running = true; requestAnimationFrame(loop); } }
function loop(now) {
  if (now < frozenUntil) return requestAnimationFrame(loop); // hit-freeze: hold the frame
  g.clearRect(0, 0, cv.width, cv.height);
  anims = anims.filter(a => {
    const f = Math.floor((now - a.t0) / 1000 * a.fps);
    if (f < 0) return true;
    if (f >= a.meta.n + a.hold) return false;
    const k = Math.min(f, a.meta.n - 1), { w, h } = a.meta, s = a.size / w;
    if (!a.im.complete || !a.im.naturalWidth) return true;
    g.save(); g.translate(a.x, a.y); g.rotate(a.rot); if (a.flip) g.scale(-1, 1);
    if (f >= a.meta.n) g.globalAlpha = 1 - (f - a.meta.n) / a.hold;
    g.drawImage(a.im, k * w, 0, w, h, -w * s / 2, -h * s / 2, w * s, h * s);
    g.restore(); g.globalAlpha = 1;
    return true;
  });
  parts = parts.filter(p => (p.life -= p.decay) > 0);
  for (const p of parts) {
    g.globalAlpha = Math.max(0, p.life);
    if (p.ring) { p.r += p.vr; g.strokeStyle = p.c; g.lineWidth = 10 * p.life; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.stroke(); continue; }
    p.x += p.vx; p.y += p.vy; p.vy += p.kind === 'gas' ? -0.02 : p.kind === 'hearts' ? 0.08 : 0.25; p.vx *= 0.985; p.rot += p.spin * 0.02;
    if (p.kind === 'gas') { g.fillStyle = p.c + (0.35 * p.life) + ')'; g.beginPath(); g.arc(p.x, p.y, p.r * (2 - p.life), 0, 7); g.fill(); continue; }
    g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
    g.fillStyle = p.c; g.strokeStyle = '#141014'; g.lineWidth = 2;
    if (p.kind === 'confetti') g.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
    else if (p.kind === 'hearts') { const r = p.r / 2; g.beginPath(); g.moveTo(0, r); g.bezierCurveTo(-r * 2, -r / 2, -r / 2, -r * 1.6, 0, -r / 2); g.bezierCurveTo(r / 2, -r * 1.6, r * 2, -r / 2, 0, r); g.fill(); g.stroke(); }
    else { g.beginPath(); for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2, rr = p.r * (k % 2 ? 0.55 : 1); g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); g.fill(); g.stroke(); }
    g.restore();
  }
  g.globalAlpha = 1;
  if (parts.length || anims.length) requestAnimationFrame(loop); else { running = false; g.clearRect(0, 0, cv.width, cv.height); }
}

// ---------------------------------------------------------------- combos
/** The big one: freeze, flash, fireball, POW, debris, shake. */
export function kaboom(x, y, power = 1, el) {
  hitstop(90 * power);
  setTimeout(() => {
    flash('#fff8ec', .55);
    sprite('boom', x, y, { size: 280 * power, fps: 16 });
    sprite('pow', x + rnd(-60, 60), y + rnd(-50, 10), { size: 150 * power, fps: 14, rot: rnd(-.4, .4), hold: 6 });
    sprite('hit', x, y, { size: 220 * power, fps: 26 });
    burst(x, y, 'boom', power);
    shake(el, 18 * power);
  }, 90 * power);
}
/** Blood: a splat, a squirt and drops, red and plenty (it is a Game of Thrones parody). */
export function gore(x, y, power = 1) {
  sprite('blood', x, y, { size: 200 * power, fps: 14, rot: rnd(0, 6), hold: 10 });
  sprite('squirt', x + 40, y - 10, { size: 190 * power, fps: 16, rot: rnd(-.6, .3), flip: Math.random() < .5, delay: 60 });
  sprite('drops', x - 30, y + 20, { size: 150 * power, fps: 12, delay: 140, hold: 8 });
  burst(x, y, 'blood', .6 * power);
}
export const chomp = (x, y) => { sprite('chomp', x, y, { size: 170, fps: 16 }); setTimeout(() => sprite('chomp', x + 60, y - 30, { size: 120, fps: 18 }), 200); };
export const bubbles = (x, y) => { for (let i = 0; i < 6; i++) sprite('bubble', x + rnd(-120, 120), y + rnd(-60, 60), { size: rnd(40, 80), fps: 8, delay: i * 90, hold: 4 }); };
export const zap = (x, y, power = 1) => { sprite('hit2', x, y, { size: 170 * power, fps: 24, rot: rnd(0, 6) }); sprite('pow', x, y, { size: 110 * power, fps: 16, hold: 3 }); };

// ---------------------------------------------------------------- screen juice
/** Decaying random shake on an element (or the whole app). */
export function shake(el, power = 12) {
  if (!prefs.shake) return;
  el ||= document.getElementById('game') || document.getElementById('gate'); // the fixed layout itself, never its zero-height parent
  const n = 12, frames = [];
  for (let i = 0; i <= n; i++) { const k = (1 - i / n) ** 2 * power; frames.push({ transform: i === n ? 'none' : `translate(${rnd(-k, k)}px, ${rnd(-k, k)}px) rotate(${rnd(-k, k) * .08}deg)` }); }
  el.animate(frames, { duration: 380 + power * 6, easing: 'linear' });
}
/** Hit-freeze: every CSS animation and the fx canvas hold still for a beat. */
export function hitstop(ms = 100) {
  if (!prefs.shake) return;
  frozenUntil = performance.now() + ms;
  document.body.classList.add('freeze');
  setTimeout(() => document.body.classList.remove('freeze'), ms);
}
export function flash(color = '#fff', alpha = .6) {
  const d = document.createElement('div');
  d.style.cssText = `position:fixed;inset:0;z-index:65;pointer-events:none;background:${color}`;
  document.body.appendChild(d);
  d.animate([{ opacity: alpha }, { opacity: 0 }], { duration: 260, easing: 'ease-out' }).onfinish = () => d.remove();
}
/** Squash and stretch, like a sticker slapped onto the wall. */
export const boing = (el, k = 1) => el?.animate([
  { transform: 'scale(1,1)' }, { transform: `scale(${1 + .25 * k},${1 - .2 * k})` }, { transform: `scale(${1 - .12 * k},${1 + .14 * k})` },
  { transform: `scale(${1 + .05 * k},${1 - .04 * k})` }, { transform: 'scale(1,1)' }], { duration: 420, easing: 'ease-out' });
export const hop = (el, h = 24) => el?.animate([
  { transform: 'translateY(0) scale(1,1)' }, { transform: 'translateY(0) scale(1.15,.85)', offset: .15 }, { transform: `translateY(-${h}px) scale(.9,1.12)`, offset: .5 },
  { transform: 'translateY(0) scale(1.12,.88)', offset: .82 }, { transform: 'translateY(0) scale(1,1)' }], { duration: 520, easing: 'ease-out' });
export const wiggle = el => el?.animate([{ rotate: '0deg' }, { rotate: '-9deg' }, { rotate: '8deg' }, { rotate: '-5deg' }, { rotate: '3deg' }, { rotate: '0deg' }], { duration: 480 });
/** Yeet an element off the screen, spinning. Resolves when it is gone. */
export function flyOut(el, dir = 1, { up = -0.6, spin = 720, ms = 700 } = {}) {
  if (!el) return Promise.resolve();
  const r = el.getBoundingClientRect(), dx = dir * (innerWidth + r.width), dy = up * innerHeight;
  return el.animate([{ transform: 'translate(0,0) rotate(0)' }, { transform: `translate(${dx * .15}px, ${dy * .5}px) rotate(${dir * spin * .2}deg)`, offset: .25 },
    { transform: `translate(${dx}px, ${dy + innerHeight * .9}px) rotate(${dir * spin}deg)`, opacity: .9 }], { duration: ms, easing: 'cubic-bezier(.3,.2,.7,1)', fill: 'forwards' }).finished.catch(() => {});
}
export const centerOf = el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
