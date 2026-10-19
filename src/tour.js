// Guided onboarding: dims the screen, cuts a hole around the thing being explained, points at it with a
// bouncing hand and a sticker card. Steps can open mock menus (before/after hooks) so every feature gets shown.
import { boing } from './fx.js';

let layer, i = 0, steps = [], done = () => {};

/** steps: [{ target: css | () => Element | null, title, text, emoji, before?, after?, pad? }] */
export function startTour(list, onDone = () => {}) {
  endTour(true);
  steps = list; done = onDone; i = 0;
  layer = document.createElement('div');
  layer.id = 'tour';
  layer.innerHTML = `<div class="tour-hole"></div><div class="tour-hand">👆</div><div class="card notape tour-card"></div>`;
  document.body.appendChild(layer);
  layer.addEventListener('click', e => {
    const b = e.target.closest('[data-tour]'); if (!b) return;
    const a = b.dataset.tour;
    if (a === 'next') go(i + 1); else if (a === 'back') go(i - 1); else endTour();
  });
  addEventListener('resize', place);
  go(0);
}
export function endTour(silent = false) {
  if (!layer) return;
  steps[i]?.after?.();
  layer.remove(); layer = null;
  removeEventListener('resize', place);
  if (!silent) done();
}
async function go(k) {
  if (k < 0) return;
  steps[i]?.after?.();
  if (k >= steps.length) return endTour();
  i = k;
  const s = steps[i];
  await s.before?.();
  const card = layer.querySelector('.tour-card');
  card.innerHTML = `<div class="tour-em">${s.emoji || '👉'}</div><h3>${s.title}</h3><p>${s.text}</p>
    <div class="tour-nav"><button class="btn tiny white" data-tour="skip">Skip</button><span class="tour-dots">${steps.map((_, j) => `<i class="${j === i ? 'on' : ''}"></i>`).join('')}</span>
    <span>${i ? '<button class="btn tiny white" data-tour="back">◀</button>' : ''}<button class="btn tiny pink" data-tour="next">${i === steps.length - 1 ? "Let's play" : 'Next ▶'}</button></span></div>`;
  setTimeout(place, 60); setTimeout(place, 600); // again once mock menus finish sliding in
}
function target() {
  const t = steps[i]?.target;
  const el = typeof t === 'function' ? t() : t ? document.querySelector(t) : null;
  return el && el.getClientRects().length ? el : null;
}
function place() {
  if (!layer) return;
  const s = steps[i], el = target(), hole = layer.querySelector('.tour-hole'), hand = layer.querySelector('.tour-hand'), card = layer.querySelector('.tour-card');
  const W = innerWidth, H = innerHeight, pad = s.pad ?? 8;
  if (!el) { // nothing to point at: a centred card on a dark screen
    Object.assign(hole.style, { left: W / 2 + 'px', top: H / 2 + 'px', width: '0px', height: '0px' });
    hand.style.display = 'none';
    Object.assign(card.style, { left: Math.max(12, (W - card.offsetWidth) / 2) + 'px', top: Math.max(12, (H - card.offsetHeight) / 2) + 'px' });
  } else {
    el.scrollIntoView?.({ block: 'nearest' });
    const r = el.getBoundingClientRect();
    Object.assign(hole.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
    // the card goes on the side with the most room; the hand points from the card toward the target
    const cw = card.offsetWidth, ch = card.offsetHeight;
    const room = { below: H - r.bottom, above: r.top, right: W - r.right, left: r.left };
    const side = ['below', 'above', 'right', 'left'].find(k => room[k] > (k === 'below' || k === 'above' ? ch + 70 : cw + 70)) || 'center';
    let x, y, hx, hy, rot;
    if (side === 'below') { x = r.left + r.width / 2 - cw / 2; y = r.bottom + 64; hx = r.left + r.width / 2; hy = r.bottom + 14; rot = 0; }
    else if (side === 'above') { x = r.left + r.width / 2 - cw / 2; y = r.top - ch - 64; hx = r.left + r.width / 2; hy = r.top - 52; rot = 180; }
    else if (side === 'right') { x = r.right + 70; y = r.top + r.height / 2 - ch / 2; hx = r.right + 14; hy = r.top + r.height / 2 - 20; rot = -90; }
    else if (side === 'left') { x = r.left - cw - 70; y = r.top + r.height / 2 - ch / 2; hx = r.left - 54; hy = r.top + r.height / 2 - 20; rot = 90; }
    else { x = (W - cw) / 2; y = H - ch - 16; hx = r.left + r.width / 2; hy = Math.min(r.bottom - 20, y - 50); rot = 0; }
    Object.assign(card.style, { left: Math.min(W - cw - 12, Math.max(12, x)) + 'px', top: Math.min(H - ch - 12, Math.max(12, y)) + 'px' });
    Object.assign(hand.style, { display: 'block', left: hx - 20 + 'px', top: hy + 'px', rotate: rot + 'deg' });
  }
  boing(card, .6);
}
