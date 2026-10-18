// Comic explosions: a canvas over everything for particles, debris, spray splats and screen shake.
let cv, g, parts = [], running = false;

function ensure() {
  if (cv) return;
  cv = document.createElement('canvas'); cv.id = 'fx';
  document.body.appendChild(cv); g = cv.getContext('2d');
  const fit = () => { const d = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * d; cv.height = innerHeight * d; g.setTransform(d, 0, 0, d, 0, 0); };
  fit(); addEventListener('resize', fit);
}
const COLORS = ['#ffe14d', '#ff2e88', '#ff3b3b', '#ff9f1c', '#fff8ec', '#836ef9', '#2de2e6'];

/** Boom at (x, y). kind: 'boom' (fire + debris), 'confetti' (party), 'gas' (green fart cloud), 'blood' (red splat). */
export function burst(x, y, kind = 'boom', power = 1) {
  ensure();
  const n = Math.round((kind === 'confetti' ? 90 : 70) * power);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = (kind === 'gas' ? 2 : 6) * power * (0.3 + Math.random());
    const p = { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (kind === 'confetti' ? 3 : 1), life: 1, decay: 0.012 + Math.random() * 0.02, r: 3 + Math.random() * 9 * power, kind, spin: Math.random() * 6, rot: Math.random() * 6 };
    p.c = kind === 'gas' ? `rgba(${120 + Math.random() * 60},${200 + Math.random() * 40},${60 + Math.random() * 40},` : kind === 'blood' ? (Math.random() < .7 ? '#e0102e' : '#8a0a1e') : COLORS[Math.floor(Math.random() * COLORS.length)];
    if (kind === 'gas') { p.vx *= .6; p.vy = -0.6 - Math.random(); p.r *= 2.2; p.decay *= .6; }
    parts.push(p);
  }
  if (kind === 'boom') for (let i = 0; i < 3; i++) parts.push({ x, y, ring: true, r: 10, vr: 9 + i * 4, life: 1, decay: 0.035 + i * 0.01, c: i ? '#ff2e88' : '#ffe14d' });
  if (!running) { running = true; requestAnimationFrame(loop); }
}

function loop() {
  g.clearRect(0, 0, cv.width, cv.height);
  parts = parts.filter(p => (p.life -= p.decay) > 0);
  for (const p of parts) {
    g.globalAlpha = Math.max(0, p.life);
    if (p.ring) { p.r += p.vr; g.strokeStyle = p.c; g.lineWidth = 10 * p.life; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.stroke(); continue; }
    p.x += p.vx; p.y += p.vy; p.vy += p.kind === 'gas' ? -0.02 : 0.22; p.vx *= 0.985; p.rot += p.spin * 0.02;
    if (p.kind === 'gas') { g.fillStyle = p.c + (0.35 * p.life) + ')'; g.beginPath(); g.arc(p.x, p.y, p.r * (2 - p.life), 0, 7); g.fill(); continue; }
    g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
    g.fillStyle = p.c; g.strokeStyle = '#141014'; g.lineWidth = 2;
    if (p.kind === 'confetti') { g.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); }
    else { g.beginPath(); for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2, rr = p.r * (k % 2 ? 0.55 : 1); g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); g.fill(); g.stroke(); }
    g.restore();
  }
  g.globalAlpha = 1;
  if (parts.length) requestAnimationFrame(loop); else { running = false; g.clearRect(0, 0, cv.width, cv.height); }
}

export function shake(el = document.body) {
  el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 500);
}
export const centerOf = el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
