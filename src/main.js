// Game of Chogs client: the gate, the court, the map, moves with explosions, the Raven, the ticker, settings.
import './style.css';
import { api, authed } from './api.js';
import { listWallets, connectInjected, connectBurner, restore, logout, walletKind } from './wallet.js';
import { unlock, sfx, setMuted, isMuted, startMusic } from './sound.js';
import { burst, shake, centerOf, kaboom, gore, chomp, bubbles, zap, flyOut, boing, hop, wiggle, flash, preloadFx } from './fx.js';
import { prefs, setPref } from './prefs.js';
import { ChogMap, buildRealm, homeOf } from './map.js';
import { chogDataURL, stickerLayerSVG } from '../shared/chogArt.js';
import { MOVES, HOUSES, TITLES, houseById, odds } from '../shared/game.js';
import { QUOTES, TOASTS } from '../shared/ravenLines.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[c]);
const pick = a => a[Math.floor(Math.random() * a.length)];
const S = { me: [], cur: null, world: null, roster: [], names: {}, chain: null, tab: 'top', q: '', seq: 0, proposals: [], spectator: false };
const app = $('#app');

// ---------------------------------------------------------------- helpers
const nm = k => S.names[k] || S.roster.find(r => r[0] === k)?.[1] || k;
/** Real Chog Genesis art (a small thumbnail unless big), or the hand-drawn doodle when the player prefers it. Bastards and heirs are doodles. */
const art = (key, big = false) => key?.startsWith('g:') && !prefs.doodles ? `/img/${big ? '' : 't/'}${key.slice(2)}` : `/art/${key}.svg`;
/** Names read in the body font; the token number gets the graffiti tag. */
const nameHTML = s => esc(s).replace(/#(\d+)/, '<span class="num">#$1</span>');
const mine = k => S.me.some(n => n.key === k);
const current = () => S.me.find(n => n.key === S.cur) || S.me[0] || null;
const EM = { stab: '🗡', duel: '⚔', feast: '🍗', propose: '💍', beget: '🍼', knee: '🧎' };
const STATS = [['cunning', '🗡', 'Cunning'], ['might', '⚔', 'Might'], ['charm', '💋', 'Charm']];
function toast(html, err = false, ms = 3800) {
  let box = $('#toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
  const t = document.createElement('div');
  t.className = 'card notape toast' + (err ? ' err' : '');
  t.innerHTML = html;
  box.appendChild(t);
  if (err) setTimeout(() => wiggle(t), 300);
  setTimeout(() => t.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(-60px) rotate(8deg)', opacity: 0 }], { duration: 300, fill: 'forwards' }).onfinish = () => t.remove(), ms);
}
const fail = e => { toast(esc(e.message || e), true); sfx('fart'); };

function portraitHTML(n, wash = 'pink') {
  const f = n.flags || {};
  const real = n.kind === 'genesis' && !prefs.doodles;
  const src = real ? art(n.key, true) : chogDataURL(n.traits, f);
  const titles = (n.titles || []).slice(0, 3).map(t => `<span class="chip" title="${esc(TITLES[t]?.desc)}">🏅 ${esc(TITLES[t]?.name || t)}</span>`).join('');
  return `<div class="splash" style="--wash:url('/fx/wash-${wash}.webp')"><div class="portrait ${f.rugged ? 'rugged' : ''} ${f.king ? 'king' : ''}"><img src="${src}" ${real ? `style="background:url('${art(n.key)}') center / cover"` : ''} alt="${esc(n.name)}">${real ? stickersOnly(n) : ''}</div>
    ${titles ? `<div class="stickers">${titles}</div>` : ''}</div>`;
}
/** Stickers alone (no Chog): a transparent layer over real Genesis art. */
function stickersOnly(n) {
  const f = n.flags || {};
  if (!Object.values(f).some(Boolean)) return '';
  return `<img class="over" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(stickerLayerSVG(f))}" alt="">`;
}
const statsHTML = n => `<div class="stats">${STATS.map(([k, e, l]) => `<div class="stat" title="${l}"><span>${e}</span><span class="bar"><i style="width:${Math.min(100, n.stats[k] / 14 * 100)}%"></i></span><b>${n.stats[k]}</b></div>`).join('')}</div>`;
const houseChip = h => `<span class="chip"><i class="sw" style="background:${h.color}"></i>${esc(h.name)}</span>`;
/** Count a number up (or down) with a squash at the end. */
function countTo(el, from, to) {
  if (!el || from === to) return;
  const t0 = performance.now(), d = 700;
  const step = t => { const k = Math.min(1, (t - t0) / d); el.textContent = (to - from > 0 && el.dataset.sign ? '+' : '') + Math.round(from + (to - from) * (1 - (1 - k) ** 3)); if (k < 1) requestAnimationFrame(step); else boing(el, 1.2); };
  requestAnimationFrame(step);
}
/** A copy of el that flies off the screen while the real one is re-rendered. */
function flyCopy(el, dir = 1) {
  if (!el) return;
  const r = el.getBoundingClientRect(), c = el.cloneNode(true);
  c.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;margin:0;z-index:66;pointer-events:none`;
  document.body.appendChild(c);
  flyOut(c, dir, { up: -0.4, ms: 800 }).then(() => c.remove());
}

// ---------------------------------------------------------------- gate
let quoteT;
function gate() {
  document.title = 'Game of Chogs';
  const demo = ['g:7', 'g:420', 'g:69'];
  app.innerHTML = `<div id="gate">
    <h1 style="margin:0"><img class="logo-big" src="/logo.webp" alt="Game of Chogs" width="557" height="328"></h1>
    <div class="quote" id="gq">“${esc(pick(QUOTES))}”</div>
    <div class="gate-chogs">${demo.map(k => `<div class="gc"><img src="${art(k, true)}" alt=""></div>`).join('')}</div>
    <div class="gate-doors">
      <div class="card door"><div class="ico">🐗</div><h3>I Hold a Chog</h3><p>Your Chog NFT is your noble. Its traits are its stats.</p>
        <div id="wallets" style="display:grid;gap:8px"></div></div>
      <div class="card door"><div class="ico">🐣</div><h3>No Chog?</h3><p>Claim a free bastard NFT. No gas, no wallet needed.</p>
        <button class="btn pink big" id="bastard">Claim a bastard</button></div>
      <div class="card door"><div class="ico">⚖️</div><h3>Judges</h3><p id="judgep">Get a free test Chog and play the full game in 30 seconds.</p>
        <button class="btn cyan big" id="faucet">Get a test Chog</button>
        <button class="btn white" id="watch">Just watch</button></div>
    </div>
    <div class="gate-foot">One free signature to log in. No gas. Built for Chogathon 2026 on Monad. <button class="btn tiny white" id="gset">⚙ Settings</button></div>
  </div>`;
  clearInterval(quoteT);
  quoteT = setInterval(() => { const q = $('#gq'); if (q) { q.textContent = `“${pick(QUOTES)}”`; boing(q, .5); } }, 5200);
  $('.gate-chogs').onclick = e => { const g = e.target.closest('.gc'); if (g) { unlock(); hop(g, 40); sfx('fart'); const [x, y] = centerOf(g); burst(x, y - 30, 'confetti', .4); } };
  $('#gset').onclick = () => openSettings();
  const ws = listWallets();
  $('#wallets').innerHTML = ws.length
    ? ws.map((w, i) => `<button class="btn mon" data-w="${i}">${w.icon ? `<img src="${w.icon}" width="20" height="20" alt="">` : ''}Connect ${esc(w.name)}</button>`).join('')
    : `<p class="small"><b>No wallet found.</b> Install Rabby, MetaMask, Phantom or Backpack, or claim a bastard.</p>`;
  $('#wallets').onclick = e => { const b = e.target.closest('[data-w]'); if (b) go(() => connectInjected(ws[+b.dataset.w].provider), 'holder', b); };
  $('#bastard').onclick = e => go(() => ws.length ? connectInjected(ws[0].provider) : connectBurner(), 'bastard', e.currentTarget);
  $('#faucet').onclick = e => go(() => ws.length ? connectInjected(ws[0].provider) : connectBurner(), 'faucet', e.currentTarget);
  $('#watch').onclick = () => { unlock(); S.spectator = true; enter(); };
  api('/api/chain').then(c => {
    S.chain = c;
    if (c.mode === 'mainnet' && !c.faucet) { $('#faucet').classList.add('hidden'); $('#judgep').textContent = 'Look around first: the realm, the throne, the Raven. Then claim a bastard to play.'; }
  }).catch(() => {});
}

async function go(connect, intent, btn) {
  unlock(); sfx('tick');
  if (btn) { boing(btn); const [x, y] = centerOf(btn); burst(x, y, 'confetti', .3); }
  try {
    await connect();
    if (intent === 'bastard') await api('/api/bastard', {}).catch(e => { if (!/One bastard/.test(e.message)) throw e; });
    if (intent === 'faucet') { const r = await api('/api/faucet', {}); toast(`Minted <b>${nameHTML(r.name)}</b> to your wallet on Monad testnet. It is yours now.`); sfx('levelup'); }
    await loadMe();
    if (!S.me.length) {
      toast('No Chog Genesis in this wallet. Claim a bastard, or grab a test Chog.', true, 6000);
      return;
    }
    enter();
  } catch (e) { fail(e); }
}

// ---------------------------------------------------------------- game shell
let map, realm, pollT, clockT;
function enter() {
  clearInterval(quoteT);
  preloadFx();
  app.innerHTML = `<div id="game" data-tab="map">
    <header id="topbar">
      <img class="logo" id="logo" src="/logo-sm.webp" alt="Game of Chogs" title="How to play">
      <div class="throne-chip" id="throne" title="The Iron Toilet"></div>
      <div class="spacer"></div>
      <button class="btn tiny white" id="ravenbtn">📰 The Raven</button>
      <div class="daybox"><b id="dayn">Day</b><br><span id="countdown"></span></div>
      <button class="btn tiny white icon-btn" id="mute" title="Sound">${isMuted() ? '🔇' : '🔊'}</button>
      <button class="btn tiny white icon-btn" id="settings" title="Settings">⚙</button>
      <button class="btn tiny white" id="who"></button>
    </header>
    <aside class="side" id="left"></aside>
    <div id="mapwrap"><canvas id="map"></canvas><div class="maphint">drag · scroll to zoom · tap a Chog</div>
      <div class="mapzoom"><button class="btn tiny white icon-btn" id="zin">+</button><button class="btn tiny white icon-btn" id="zout">−</button></div></div>
    <aside class="side" id="right"></aside>
    <footer id="ticker"><div class="track" id="track"></div></footer>
    <nav id="mobnav"><button data-t="map" class="on"><span>🗺</span>Map</button><button data-t="me"><span>🐗</span>Me</button><button data-t="court"><span>👑</span>Court</button><button data-t="raven"><span>📰</span>Raven</button></nav>
  </div>`;
  $('#mute').onclick = () => { setMuted(!isMuted()); $('#mute').textContent = isMuted() ? '🔇' : '🔊'; boing($('#mute')); };
  $('#settings').onclick = () => openSettings();
  $('#ravenbtn').onclick = () => openRaven();
  $('#logo').onclick = () => { wiggle($('#logo')); openTutorial(); };
  $('#who').textContent = S.spectator ? 'PLAY' : (walletKind() === 'burner' ? 'BURNER ' : '') + (S.address || '').slice(0, 6) + '…';
  $('#who').onclick = () => { if (S.spectator || confirm('Log out?')) { logout(); location.reload(); } };
  $('#mobnav').onclick = e => {
    const b = e.target.closest('[data-t]'); if (!b) return;
    sfx('tick');
    if (b.dataset.t === 'raven') return openRaven();
    $('#game').dataset.tab = b.dataset.t;
    for (const x of $('#mobnav').children) x.classList.toggle('on', x === b);
    if (b.dataset.t === 'map') map?.fit();
    if (b.dataset.t === 'court') { S.anim = true; renderRight(); }
  };
  realm ||= buildRealm();
  map = new ChogMap($('#map'), realm, {
    onPickHouse: h => { S.tab = 'house:' + h.id; S.anim = true; renderRight(); toast(`<b>House ${esc(h.name)}</b>: “${esc(h.words)}”`); sfx('tick'); if (innerWidth <= 900) $('#mobnav [data-t=court]').click(); },
    onPickPin: p => { sfx('swoosh'); openNoble(p.key); },
  });
  $('#zin').onclick = () => map.zoom(1.3); $('#zout').onclick = () => map.zoom(1 / 1.3);
  S.anim = true;
  renderLeft(); renderRight();
  poll(true);
  clearInterval(pollT); pollT = setInterval(() => poll(), 6000);
  clearInterval(clockT); clockT = setInterval(countdown, 1000);
  try { if (!localStorage.getItem('goc:tut') && !S.spectator) openTutorial(); else whileYouSlept(); } catch {}
  startMusic();
}
const rerenderAll = () => { if ($('#gate')) return gate(); renderLeft(); S.anim = true; renderRight(); renderThrone(); renderPins(); };

/** The retention hook: everything that happened to your Chogs since you last looked, with revenge buttons. */
function whileYouSlept() {
  const k = 'goc:seen:' + S.address;
  let seen = 0;
  try { seen = +localStorage.getItem(k) || 0; } catch {}
  const evs = S.me.flatMap(n => n.log || []).filter((e, i, a) => a.findIndex(x => x.id === e.id) === i).sort((a, b) => a.id - b.id);
  const max = evs.reduce((m, e) => Math.max(m, e.id), seen);
  try { localStorage.setItem(k, max); } catch {}
  const news = evs.filter(e => e.id > seen && mine(e.b) && !mine(e.a));
  if (!seen || !news.length) return;
  const foes = [...new Set(news.filter(e => /stab_win|kingslayer|oathbreak|duel_win|propose_reject/.test(e.type)).map(e => e.a))].slice(0, 4);
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="card tut"><div class="em">😱</div><h2 class="tag pink">While You Slept…</h2>
    <div class="feed">${news.slice(-6).reverse().map(e => `<div>${evText(e)}</div>`).join('')}</div>
    ${foes.length ? `<p><b>The Chain remembers.</b> Revenge is +15% for 3 days.</p><div style="display:flex;gap:6px;flex-wrap:wrap">${foes.map(f => `<button class="btn tiny red" data-k="${f}">🗡 ${nameHTML(nm(f))}</button>`).join('')}</div>` : ''}
    <div style="text-align:right;margin-top:12px"><button class="btn" id="wysok">Fine. I'm awake.</button></div></div>`;
  document.body.appendChild(ov);
  sfx(foes.length ? 'shame' : 'reveal');
  ov.onclick = e => {
    if (e.target === ov || e.target.id === 'wysok') return closeOv(ov);
    const b = e.target.closest('[data-k]'); if (b) { ov.remove(); openNoble(b.dataset.k); }
  };
}
/** Overlays leave by flying off the screen. */
function closeOv(ov) {
  const card = ov.firstElementChild;
  ov.style.pointerEvents = 'none';
  ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 380, fill: 'forwards' });
  card ? flyOut(card, Math.random() < .5 ? -1 : 1, { up: -0.2, spin: 200, ms: 420 }).then(() => ov.remove()) : ov.remove();
  sfx('swoosh');
}

function countdown() {
  if (!S.world) return;
  const ms = S.world.nextTick - Date.now();
  const h = Math.floor(ms / 3600e3), m = Math.floor(ms / 60e3) % 60, s = Math.floor(ms / 1e3) % 60;
  $('#countdown') && ($('#countdown').textContent = ms > 0 ? `crowning in ${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s` : 'the raven is flying…');
}

async function loadMe() {
  const r = await api('/api/me');
  S.address = r.address; S.me = r.nobles; S.proposals = r.proposals; Object.assign(S.names, r.names);
  if (!S.cur || !mine(S.cur)) S.cur = S.me[0]?.key || null;
  S.spectator = false;
}

const KIND = t => /stab|kingslayer|red_wedding|oathbreak|rugged/.test(t) ? 'stab' : /duel/.test(t) ? 'duel' : /marry|beget|propose/.test(t) ? 'love' : 'crown';
async function poll(first = false) {
  try {
    const [w, roster] = await Promise.all([api('/api/world?since=' + (first ? Math.max(0, S.seq - 40) : S.seq)), first || Math.random() < 0.35 ? api('/api/roster') : null]);
    const fresh = first ? [] : w.events;
    S.world = w; Object.assign(S.names, w.names);
    if (roster) S.roster = roster;
    if (first) S.feed = w.events.slice(-40); else S.feed = [...(S.feed || []), ...w.events].slice(-40);
    S.seq = w.seq;
    const dn = $('#dayn'); if (dn && dn.textContent !== 'Day ' + w.day) { dn.innerHTML = `Day <span>${w.day}</span>`; boing(dn, 1.4); }
    renderThrone(); renderTicker(); renderPins(); countdown();
    if (S.tab === 'feasts') renderRight();
    let hitMe = false;
    for (const e of fresh) {
      const loc = e.b && pinPos(e.b);
      if (loc) map.pulse(loc[0], loc[1], /stab|kingslayer|red_wedding|oathbreak/.test(e.type) ? '#ff3b3b' : /marry|beget/.test(e.type) ? '#ff2e88' : '#ffe14d', KIND(e.type), e.b);
      if (mine(e.b) && !mine(e.a)) {
        hitMe = true;
        toast(`<b>${evText(e)}</b>`, /stab_win|kingslayer|oathbreak|duel_win|red_wedding/.test(e.type) && e.b !== e.a);
        if (/stab_win|kingslayer/.test(e.type)) { sfx('hit'); shake(null, 10); flash('#ff3b3b', .25); }
      }
      if (e.type === 'crown') { sfx('fanfare'); const t = $('#throne'); if (t) { hop(t, 20); const [x, y] = centerOf(t); burst(x, y, 'confetti', .6); } }
    }
    if (hitMe || first) { if (authed() && !S.spectator) await loadMe().catch(() => {}); renderLeft(); }
    if (roster && S.tab !== 'feasts' && document.activeElement?.id !== 'q') renderRight();
  } catch (e) { console.warn(e); }
}

function pinPos(key) {
  const r = S.roster.find(x => x[0] === key);
  return r ? homeOf(realm, key, r[2]) : null;
}
function renderPins() {
  if (!map) return;
  const top = [...S.roster].sort((a, b) => b[3] - a[3]).slice(0, 14).map(r => r[0]);
  const keys = new Set([...top, ...S.me.map(n => n.key), S.world?.throne?.king, ...(S.world?.feasts || []).map(f => f.host)].filter(Boolean));
  const pins = [];
  for (const k of keys) {
    const r = S.roster.find(x => x[0] === k); if (!r) continue;
    const [x, y] = homeOf(realm, k, r[2]);
    const king = S.world?.throne?.king === k, me = mine(k), feast = S.world?.feasts?.some(f => f.host === k);
    pins.push({ key: k, x, y, src: art(k), r: king ? 34 : me ? 30 : 22, ring: king ? '#ffe14d' : me ? '#2de2e6' : '#fff8ec', glow: king ? '#ffe14d' : me ? '#2de2e6' : null,
      badge: king ? '👑' : feast ? '🍗' : r[5] ? '☠' : null, label: me ? 'YOU' : king ? 'THE KING' : null, labelColor: me ? '#2de2e6' : '#ffe14d' });
  }
  pins.sort((a, b) => a.r - b.r);
  map.setPins(pins);
}
function renderThrone() {
  const t = S.world?.throne, k = t?.king, el = $('#throne');
  if (!el) return;
  el.innerHTML = k ? `<img src="${art(k)}" alt=""><div><b>👑 ${nameHTML(nm(k))}</b><small>sits the Iron Toilet</small></div>` : '';
  el.onclick = () => k && openNoble(k);
}

// ---------------------------------------------------------------- left: my chog
function renderLeft() {
  const L = $('#left'); if (!L) return;
  const n = current();
  if (!n) {
    L.innerHTML = `<div class="card me" style="text-align:center"><div style="font-size:3rem">👀</div><h2 class="name">Spectating</h2><p>Read the Raven, stalk the court, judge everyone silently.</p>
      <button class="btn pink big" id="joinb" style="width:100%">Claim a bastard</button></div>`;
    $('#joinb').onclick = e => go(() => listWallets().length ? connectInjected(listWallets()[0].provider) : connectBurner(), 'bastard', e.currentTarget);
    return;
  }
  const h = houseById(n.house), prev = S.shown?.key === n.key ? S.shown.clout : n.clout;
  const grudges = Object.keys(n.grudges || {});
  L.innerHTML = `${S.me.length > 1 ? `<div class="switcher">${S.me.map(m => `<img src="${art(m.key)}" data-k="${m.key}" class="${m.key === n.key ? 'on' : ''}" title="${esc(m.name)}" alt="">`).join('')}</div>` : ''}
    <div class="card me" id="mecard">
      ${portraitHTML(n, 'cyan')}
      <h2 class="name">${nameHTML(n.name)}</h2>
      <div class="chips">${houseChip(h)}<span class="chip">${esc(n.tier)}</span>${n.kind === 'bastard' ? '<span class="chip">Bastard</span>' : ''}${n.flags.rugged ? '<span class="chip" style="background:var(--red);color:#fff">☠ Rugged</span>' : ''}${!n.adult ? '<span class="chip" style="background:var(--cyan)">🍼 Chogling</span>' : ''}</div>
      <div class="bigclout"><b id="myclout">${prev}</b><span>clout</span><span class="rk">#${n.rank}</span></div>
      <div class="gas">${[0, 1, 2].map(i => `<span class="pip ${i < n.gas ? '' : 'off'}" title="gas">💨</span>`).join('')}<small>&nbsp;${n.gas} gas left today</small></div>
      ${statsHTML(n)}
      <div class="chips">${relChips(n)}</div>
      ${n.tx ? `<div class="small" style="margin-top:6px"><a href="${S.chain?.explorer}/tx/${n.tx}" target="_blank" rel="noopener">minted on-chain ↗</a></div>` : ''}
    </div>
    <div class="inbox">${S.proposals.filter(p => p.to === n.key).map(p => `<div class="card notape"><b>💍 ${nameHTML(nm(p.from))}</b> wants to marry you.
      <div style="display:flex;gap:6px;margin-top:8px"><button class="btn tiny lime" data-yes="${p.from}">I do</button><button class="btn tiny red" data-no="${p.from}">Ew, no</button><button class="btn tiny white" data-k="${p.from}">Who?</button></div></div>`).join('')}</div>
    <div class="section-h tag cyan">Moves</div>
    <div class="moves two">${['feast', 'beget'].map(m => moveBtn(m, n, null)).join('')}</div>
    <p class="small muted" style="margin:8px 0 0">Tap any Chog on the map or in the court to stab, duel, propose or kneel.</p>
    ${grudges.length ? `<div class="section-h tag pink">Grudges</div><div class="chips">${grudges.map(k => `<span class="chip link" data-k="${k}">🩸 ${nameHTML(nm(k))}</span>`).join('')}</div><p class="small muted" style="margin:6px 0 0">Revenge on them is +15%.</p>` : ''}
    <div class="section-h tag">Recently</div>
    <div class="feed">${(n.log || []).slice(-6).reverse().map(e => `<div>${evText(e)}</div>`).join('') || '<span class="muted">Nothing yet. Go stab someone.</span>'}</div>
    <p class="small muted" style="margin-top:22px">${S.chain ? `Chain: <b>${S.chain.mode}</b>${S.chain.ledger ? ` · <a href="${S.chain.explorer}/address/${S.chain.ledger}" target="_blank" rel="noopener">ledger ↗</a>` : ''} · ` : ''}<a href="#" onclick="event.preventDefault();window.__tut()">how to play</a></p>`;
  countTo($('#myclout'), prev, n.clout);
  S.shown = { key: n.key, clout: n.clout };
  L.onclick = e => {
    const t = e.target.closest('[data-k],[data-yes],[data-no],[data-move]') || e.target;
    if (t.dataset.k && t.tagName === 'IMG' && t.closest('.switcher')) { S.cur = t.dataset.k; sfx('tick'); renderLeft(); renderPins(); hop($('#mecard .portrait'), 16); return; }
    if (t.dataset.k) return openNoble(t.dataset.k);
    if (t.dataset.yes || t.dataset.no) return answer(t.dataset.yes || t.dataset.no, !!t.dataset.yes);
    if (t.dataset.move) doMove(t.dataset.move, null, t);
  };
}
function relChips(n) {
  const c = (k, emoji) => k ? `<span class="chip link" data-k="${k}">${emoji} ${nameHTML(nm(k))}</span>` : '';
  return c(n.spouse, '💍') + c(n.liege, '🧎')
    + (n.vassals?.length ? `<span class="chip" title="${esc(n.vassals.map(nm).join(', '))}">🛡 ${n.vassals.length} vassal${n.vassals.length > 1 ? 's' : ''}</span>` : '')
    + (n.heirs || []).map(k => c(k, '🍼')).join('')
    + (n.parents ? n.parents.map(k => c(k, '🧬')).join('') : '')
    + (n.lords?.length > 1 ? `<span class="chip" title="Previous lords of this Chog">📜 ${n.lords.length} lords</span>` : '');
}
function moveBtn(m, a, b) {
  const M = MOVES[m];
  let pct = '';
  if (b && M.target && ['stab', 'duel', 'propose'].includes(m) && S.world) {
    const w = { day: S.world.day, throne: S.world.throne, nobles: {} };
    const full = x => ({ ...x, grudges: x.grudges || {}, stats: x.stats });
    try { pct = Math.round(odds({ ...w, nobles: Object.fromEntries(S.roster.map(r => [r[0], { key: r[0], clout: r[3] }])) }, full(a), m, full(b)) * 100) + '%'; } catch {}
  }
  const color = { stab: 'red', duel: 'mon', feast: 'lime', propose: 'pink', beget: 'cyan', knee: 'white' }[m];
  const label = { knee: 'KNEEL', beget: 'BEGET' }[m] || M.label;
  return `<button class="btn move ${color}" data-move="${m}" title="${esc(M.blurb)}" ${a.gas < M.gas || a.flags?.rugged ? 'disabled' : ''}><span class="em">${EM[m]}</span><span><span class="lbl">${label}</span><span class="cost">${'💨'.repeat(M.gas)}</span></span>${pct ? `<span class="odds">${pct}</span>` : ''}</button>`;
}

// ---------------------------------------------------------------- right: the court
function renderRight() {
  const R = $('#right'); if (!R) return;
  const tabs = [['top', '🏆 Top'], ['enemies', '🩸 Enemies'], ['feasts', '🍗 Feasts'], ['players', '🔥 Players'], ['houses', '🏰 Houses']];
  let rows = S.roster;
  const me = current();
  if (S.tab === 'enemies') rows = rows.filter(r => me?.grudges?.[r[0]] || S.feed?.some(e => e.a === r[0] && mine(e.b)));
  if (S.tab === 'players') rows = rows.filter(r => r[4]);
  if (S.tab.startsWith('house:')) rows = rows.filter(r => r[2] === S.tab.slice(6));
  if (S.q) { const q = S.q.toLowerCase(); rows = S.roster.filter(r => r[1].toLowerCase().includes(q) || r[0] === 'g:' + q); }
  rows = [...rows].sort((a, b) => b[3] - a[3]);
  const rank = new Map([...S.roster].sort((a, b) => b[3] - a[3]).map((r, i) => [r[0], i + 1]));
  let body;
  if (S.tab === 'feasts' && !S.q) {
    const fs = S.world?.feasts || [];
    body = fs.length ? fs.map(f => `<div class="card notape" style="padding:12px;margin:10px 0"><b>🍗 ${nameHTML(f.hostName)}</b> is feasting · ${f.guests.length} guests
      <div class="small muted">Ends in ${Math.max(0, Math.round((f.until - Date.now()) / 60e3))} min. Enemies at one table = Red Wedding.</div>
      <div style="display:flex;gap:6px;margin-top:8px">${me && !mine(f.host) && !f.guests.includes(me.key) ? `<button class="btn tiny lime" data-rsvp="${f.id}">Attend (free)</button>` : ''}<button class="btn tiny white" data-k="${f.host}">Host</button></div></div>`).join('')
      : `<p class="muted">No feasts right now. Throw one: 1 gas, and the guests bring you clout.</p>`;
  } else if (S.tab === 'houses' && !S.q) {
    body = HOUSES.map(h => { const ms = S.roster.filter(r => r[2] === h.id); const total = ms.reduce((s, r) => s + r[3], 0);
      return `<div class="row" data-house="${h.id}"><span class="rk"></span><span style="width:48px;height:48px;border:2px solid #000;border-radius:12px;background:${h.color}"></span><span class="nm">House ${esc(h.name)}<small>“${esc(h.words)}”</small></span><span class="cl">${total}</span></div>`; }).join('');
  } else {
    body = rows.slice(0, 80).map(r => `<div class="row ${r[5] ? 'rugged' : ''} ${mine(r[0]) ? 'mine' : ''}" data-k="${r[0]}"><span class="rk">${rank.get(r[0])}</span><img src="${art(r[0])}" loading="lazy" alt=""><span class="nm">${nameHTML(r[1])}${r[0] === S.world?.throne?.king ? ' 👑' : ''}<small><i style="background:${houseById(r[2]).color}"></i>${esc(houseById(r[2]).name)}${r[4] ? ' · 🔥' : ''}${r[5] ? ' · ☠' : ''}${r[7] ? ' · 💍' : ''}</small></span><span class="cl">${r[3]}</span></div>`).join('')
      || `<p class="muted">${!S.world ? 'Summoning the court…' : S.tab === 'enemies' ? 'No enemies yet. Make some.' : 'Nobody here.'}</p>`;
  }
  R.innerHTML = `<div class="section-h tag" style="margin-top:0">The Court</div>
    <input class="search" id="q" placeholder="Search a Chog (name or #)…" value="${esc(S.q)}">
    <div class="tabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${S.tab === k ? 'on' : ''}">${l}</button>`).join('')}${S.tab.startsWith('house:') ? `<button class="on">House ${esc(houseById(S.tab.slice(6)).name)}</button>` : ''}</div>
    <div id="rows" class="${S.anim ? 'pop-in' : ''}">${body}</div>`;
  S.anim = false;
  const q = $('#q');
  q.oninput = () => { S.q = q.value.trim(); const pos = q.selectionStart; renderRight(); const nq = $('#q'); nq.focus(); nq.setSelectionRange(pos, pos); };
  R.onclick = e => {
    const t = e.target.closest('[data-tab],[data-k],[data-rsvp],[data-house]'); if (!t) return;
    sfx('tick');
    if (t.dataset.tab) { S.tab = t.dataset.tab; S.q = ''; S.anim = true; return renderRight(); }
    if (t.dataset.house) { S.tab = 'house:' + t.dataset.house; S.anim = true; return renderRight(); }
    if (t.dataset.rsvp) return attend(+t.dataset.rsvp);
    boing(t.querySelector('img'));
    openNoble(t.dataset.k);
  };
}

// ---------------------------------------------------------------- ticker + event text
/** One line about an event. Returns HTML: names are escaped and their numbers tagged. */
function evText(e) {
  const a = nameHTML(nm(e.a)), b = nameHTML(nm(e.b));
  switch (e.type) {
    case 'stab_win': return `🗡 ${a} stabbed ${b} (+${e.n} clout)`;
    case 'stab_fail': return `🔔 ${a} tried to stab ${b} and got caught. <b>SHAME!</b>`;
    case 'kingslayer': return `👑🗡 ${a} <b>STABBED THE KING</b>, ${b}!`;
    case 'oathbreak': return `🐍 ${a} betrayed their liege ${b}`;
    case 'duel_win': return `⚔ ${a} beat ${b} in a duel`;
    case 'feast': return `🍗 ${a} is throwing a feast${e.n ? ` (${e.n} guests)` : ''}`;
    case 'red_wedding': return `🩸 <b>RED WEDDING</b> at ${a}'s feast!`;
    case 'propose': return `💍 ${a} proposed to ${b}`;
    case 'marry': return `💒 ${a} married ${b}`;
    case 'propose_reject': return `💔 ${b} rejected ${a}`;
    case 'beget': return `🍼 ${a} & ${b} begot ${nameHTML(nm(e.heir))}`;
    case 'knee': return `🧎 ${a} bent the knee to ${b}`;
    case 'crown': return `👑 ${a} now sits the Iron Toilet`;
    case 'rugged': return `☠ ${a} got rugged${e.b ? ` by ${b}` : ''}`;
    case 'claim': return `🔥 ${a} has awoken: a holder claimed them`;
    case 'new_lord': return `💰 ${a} has a new lord`;
    case 'bastard': return `🐣 ${a} crawled into the realm`;
    case 'streak': return `🌙 ${a} has manned the Watch ${e.n} days running`;
    case 'title': return `🏅 ${a} earned "${esc(TITLES[e.title]?.name || e.title)}"`;
    default: return `${a} did something`;
  }
}
function renderTicker() {
  const t = $('#track'); if (!t) return;
  const evs = (S.feed || []).slice(-25).reverse();
  const html = evs.map(e => `<span data-k="${e.a}">${evText(e)}</span>`).join('') || '<span>The realm is quiet. Too quiet.</span>';
  t.innerHTML = html + html; // twice, so the loop is seamless
  t.style.animationDuration = Math.max(30, evs.length * 6) + 's';
  t.onclick = e => { const s = e.target.closest('[data-k]'); if (s?.dataset.k) openNoble(s.dataset.k); };
}

// ---------------------------------------------------------------- noble sheet
async function openNoble(key) {
  let r;
  try { r = await api('/api/noble/' + encodeURIComponent(key)); } catch (e) { return fail(e); }
  Object.assign(S.names, r.names);
  const n = r.noble, h = houseById(n.house), me = current(), self = me && me.key === n.key;
  const ov = document.createElement('div');
  ov.className = 'overlay bottom';
  const wash = { snark: 'cyan', lambopiss: 'red', targaryeet: 'mon', greyjoint: 'yellow', tyrelly: 'lime', bagatheon: 'yellow', martelly: 'mon' }[h.id] || 'pink';
  ov.innerHTML = `<div class="card sheet">
    <button class="x" aria-label="close">✕</button>
    <div class="sh-head">
      ${portraitHTML(n, wash)}
      <div>
        <h2>${nameHTML(n.name)}</h2>
        <div class="chips">${houseChip(h)}<span class="chip">${esc(n.tier)}</span><span class="chip">${n.claimed ? '🔥 Player' : '🤖 Bot'}</span></div>
        <div class="bigclout"><b>${n.clout}</b><span>clout</span><span class="rk">#${n.rank}</span></div>
        ${statsHTML(n)}
      </div>
    </div>
    <div class="chips">${relChips(n)}${Object.keys(n.grudges).length ? `<span class="chip" title="${esc(Object.keys(n.grudges).map(nm).join(', '))}">🩸 ${Object.keys(n.grudges).length} grudge${Object.keys(n.grudges).length > 1 ? 's' : ''}</span>` : ''}</div>
    ${me && !self && !S.spectator ? `<div class="moves">${['stab', 'duel', 'propose', 'knee'].map(m => moveBtn(m, me, n)).join('')}</div>
      <p class="small muted" style="margin:6px 0 0;text-align:center">as ${nameHTML(me.name)} · ${me.gas} 💨 left</p>` : ''}
    ${S.spectator ? `<p class="small" style="text-align:center">Claim a bastard to stab this Chog.</p>` : ''}
    <details class="recent"><summary>What they've been up to (${n.log.length})</summary><div class="feed">${n.log.slice().reverse().map(e => `<div>${evText(e)} <span class="muted">· day ${e.day}</span></div>`).join('') || '<span class="muted">A quiet life. For now.</span>'}</div></details>
    <div class="foot">${n.kind === 'genesis' ? `<a href="https://opensea.io/item/monad/0xc96d31f8626c6d03fae5dcd3d61e3fb9f4a73763/${n.id}" target="_blank" rel="noopener">view NFT on OpenSea ↗</a>` : `<a href="/meta/${n.kind}/${n.id}" target="_blank" rel="noopener">live NFT metadata ↗</a>`}</div>
  </div>`;
  document.body.appendChild(ov);
  sfx('swoosh');
  setTimeout(() => hop(ov.querySelector('.portrait'), 18), 380);
  ov.onclick = e => {
    if (e.target === ov || e.target.closest('.x')) return closeOv(ov);
    const k = e.target.closest('[data-k]')?.dataset.k; if (k) { ov.remove(); return openNoble(k); }
    const mv = e.target.closest('[data-move]');
    if (mv && !mv.disabled) {
      const [x, y] = centerOf(mv);
      zap(x, y, .7); boing(mv);
      ov.style.pointerEvents = 'none';
      flyOut(ov.firstElementChild, 1, { up: -0.3, spin: 260, ms: 380 }).then(() => ov.remove());
      doMove(mv.dataset.move, n, null);
    }
  };
}

// ---------------------------------------------------------------- moves + the slam
const WORDS = { stab_win: 'Shanked!', stab_fail: 'Shame!', kingslayer: 'Kingslayer!', oathbreak: 'Betrayal!', duel_win: 'Victory!', duel_lose: 'Rekt!', feast: 'Feast!',
  red_wedding: 'Red Wedding!', marry: 'Wed!', propose_reject: 'Rejected!', propose: 'Proposed!', beget: 'Chogling!', knee: 'Sworn!' };
const WASH = { stab_win: 'red', kingslayer: 'red', oathbreak: 'red', red_wedding: 'red', stab_fail: 'lime', duel_win: 'yellow', duel_lose: 'mon', feast: 'yellow', marry: 'pink', propose: 'pink', propose_reject: 'mon', beget: 'cyan', knee: 'cyan' };
async function doMove(move, target, btn) {
  const me = current(); if (!me) return;
  if (btn) { const [x, y] = centerOf(btn); zap(x, y, .6); boing(btn); }
  [...document.querySelectorAll('#left .pip:not(.off)')].slice(-MOVES[move].gas).forEach((p, i) => setTimeout(() => flyCopy(p, i % 2 ? 1 : -1), i * 90));
  sfx('fart');
  let r;
  try { r = await api('/api/move', { noble: me.key, move, target: target?.key }); } catch (e) { return fail(e); }
  Object.assign(S.names, r.names);
  const before = me.clout;
  S.me = S.me.map(n => n.key === r.me.key ? r.me : n);
  slam(move, r, target, before);
  renderLeft(); poll();
}
function slam(move, r, target, before) {
  const ev = r.boom || r.ev, me = r.me;
  let kind = ev?.type || move;
  if (move === 'duel') kind = r.ok ? 'duel_win' : 'duel_lose';
  if (r.pending) kind = 'propose';
  const word = WORDS[kind] || 'Done!';
  const toastKey = { stab_win: 'stab_win', kingslayer: 'stab_win', oathbreak: 'stab_win', stab_fail: 'stab_fail', duel_win: 'duel_win', duel_lose: 'duel_lose', feast: 'feast', red_wedding: 'feast', marry: 'propose', propose: 'propose', propose_reject: 'propose', beget: 'beget', knee: 'knee' }[kind];
  const line = r.boom ? 'The feast turned into a Red Wedding. Everyone at the table loses clout.' : pick(TOASTS[toastKey] || ['It is done.']);
  const d = me.clout - before;
  const ov = document.createElement('div');
  ov.id = 'slam';
  const loser = (kind === 'stab_win' || kind === 'kingslayer' || kind === 'duel_win' || kind === 'oathbreak') ? 'b' : (kind === 'stab_fail' || kind === 'duel_lose') ? 'a' : '';
  const right = target ? art(target.key, true) : r.heir ? art(r.heir.key, true) : null;
  const thumb = k => `style="background:#e9e1d2 url('${art(k)}') center / cover"`; // the small copy shows while the big one loads
  const rk = target?.key || r.heir?.key;
  ov.innerHTML = `<div class="vs"><img class="a" src="${art(me.key, true)}" ${thumb(me.key)} alt="">${right ? `<span class="vsx">${/marry|propose|beget/.test(kind) ? '❤' : 'VS'}</span><img class="b" src="${right}" ${thumb(rk)} alt="">` : ''}</div>
    <div class="word tag wc" style="--wash:url('/fx/wash-${WASH[kind] || 'pink'}.webp')">${word}</div>
    <div class="line">${esc(line)}</div>
    ${r.heir ? `<div class="line">Say hello to <b>${nameHTML(r.heir.name)}</b>, a Chogling NFT.</div>` : ''}
    <div class="delta"><span>CLOUT</span><b class="${d >= 0 ? 'up' : 'down'}" id="dclout" data-sign="1">0</b><span>${me.gas} 💨 left</span></div>
    <div class="stamps">${(r.titles || []).map(t => `<div class="stamp">${esc(TITLES[t]?.name || t)}</div>`).join('')}</div>
    <div class="btns"><button class="btn big" id="carry">Carry on</button><button class="btn big mon" id="brag">Brag on X</button></div>`;
  document.body.appendChild(ov);
  ov.querySelector('#brag').onclick = () => {
    const what = { stab_win: `just SHANKED ${target ? nm(target.key) : 'someone'} 🗡`, kingslayer: `just STABBED THE KING 👑🗡`, stab_fail: `got caught mid-stab and did the walk of shame 🔔`, duel_win: `won a duel ⚔`, duel_lose: `lost a duel and is now wearing a bandage`,
      red_wedding: `threw a feast that turned into a RED WEDDING 🩸`, feast: `is throwing a feast 🍗`, marry: `just got married 💒`, propose_reject: `got rejected 💔`, beget: `just begot a Chogling 🍼`, knee: `bent the knee 🧎`, oathbreak: `betrayed their liege 🐍` }[kind] || 'is scheming';
    window.open('https://x.com/intent/tweet?text=' + encodeURIComponent(`My Chog ${what} in the Game of Chogs.

"${pick(QUOTES)}"

@ChogNFT #Chogathon`) + '&url=' + encodeURIComponent(location.origin), '_blank');
  };
  const A = ov.querySelector('img.a'), B = ov.querySelector('img.b'), W = ov.querySelector('.word');
  const at = el => el ? centerOf(el) : [innerWidth / 2, innerHeight * .3];
  // the collision: portraits fly in (CSS), then impact
  setTimeout(() => {
    const L = loser === 'a' ? A : loser === 'b' ? B : null, Wn = loser === 'a' ? B : A;
    const [lx, ly] = at(L || B || A);
    if (/stab_win|kingslayer|oathbreak/.test(kind)) {
      sfx('hit'); setTimeout(() => sfx('boom'), 90);
      kaboom(lx, ly, kind === 'kingslayer' ? 1.3 : 1, ov); gore(lx, ly, kind === 'kingslayer' ? 1.3 : 1);
      setTimeout(() => { sfx('swoosh'); flyOut(L, 1); hop(Wn, 30); }, 520);
    } else if (kind === 'stab_fail') {
      sfx('bell'); setTimeout(() => sfx('bell'), 900); setTimeout(() => sfx('shame'), 1700);
      zap(lx, ly); burst(lx, ly, 'gas', 1.2); wiggle(A); A.style.filter = 'grayscale(1) brightness(.75)';
      setTimeout(() => { hop(B, 30); boing(B); }, 400);
    } else if (/duel/.test(kind)) {
      sfx('hit2'); sfx('boom2');
      const [ax, ay] = at(A), [bx, by] = at(B); zap(ax, ay); zap(bx, by);
      kaboom((ax + bx) / 2, (ay + by) / 2, .9, ov);
      setTimeout(() => { sfx('swoosh'); flyOut(L, loser === 'a' ? -1 : 1); hop(Wn, 30); }, 560);
    } else if (kind === 'red_wedding') {
      sfx('boom'); setTimeout(() => sfx('far'), 250);
      kaboom(innerWidth / 2, innerHeight * .3, 1.5, ov); gore(innerWidth / 2 - 90, innerHeight * .3, 1.4); gore(innerWidth / 2 + 90, innerHeight * .32, 1.2);
    } else if (kind === 'feast') {
      sfx('reveal'); chomp(lx, ly - 20); burst(lx, ly, 'confetti', 1.2); hop(A, 34);
    } else if (/marry|propose/.test(kind)) {
      sfx('reveal'); burst(innerWidth / 2, at(A)[1], 'hearts', 1.2); bubbles(innerWidth / 2, at(A)[1]); hop(A, 26); setTimeout(() => hop(B, 26), 150);
    } else if (kind === 'beget') {
      sfx('levelup'); burst(lx, ly, 'confetti', 1.3); zap(lx, ly); setTimeout(() => sfx('fart'), 500); hop(B, 40);
    } else if (/reject/.test(kind)) {
      sfx('shame'); burst(lx, ly, 'gas', 1); wiggle(A); setTimeout(() => flyOut(A, -1, { up: -0.2 }), 500);
    } else { sfx('swoosh'); burst(lx, ly, 'confetti', .8); A?.animate([{ rotate: '0deg' }, { rotate: '-25deg', translate: '0 14px' }, { rotate: '0deg' }], { duration: 700 }); }
  }, 430);
  setTimeout(() => { boing(W, 1.3); countTo(ov.querySelector('#dclout'), 0, d); }, 900);
  if (r.titles?.length) setTimeout(() => { sfx('fanfare'); shake(ov, 8); }, 1250);
  ov.querySelector('#carry').onclick = () => { sfx('swoosh'); ov.style.pointerEvents = 'none'; for (const el of ov.children) flyOut(el, Math.random() < .5 ? -1 : 1, { up: -.3, spin: 300, ms: 500 }); ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: 'forwards' }).onfinish = () => ov.remove(); };
  ov.onclick = e => { if (e.target === ov) ov.querySelector('#carry').click(); };
}
async function attend(feastId) {
  const me = current(); if (!me) return;
  try {
    const r = await api('/api/rsvp', { noble: me.key, feast: feastId });
    Object.assign(S.names, r.names);
    S.me = S.me.map(n => n.key === r.me.key ? r.me : n);
    if (r.boom) slam('feast', { boom: r.ev, ev: r.ev, me: r.me, titles: [] }, null, me.clout);
    else { toast('🍗 You ate everything. +1 clout for you, +2 for the host.'); sfx('reveal'); chomp(innerWidth / 2, 150); }
    renderLeft(); poll();
  } catch (e) { fail(e); }
}
async function answer(from, yes) {
  const me = current();
  try {
    const r = await api('/api/answer', { noble: me.key, from, yes });
    Object.assign(S.names, r.names);
    S.me = S.me.map(n => n.key === r.me.key ? r.me : n);
    S.proposals = S.proposals.filter(p => p.from !== from);
    slam('propose', { ev: r.ev, me: r.me, ok: yes, titles: r.titles || [] }, { key: from }, me.clout);
    renderLeft();
  } catch (e) { fail(e); }
}

// ---------------------------------------------------------------- the raven
async function openRaven(day) {
  const days = S.world?.ravenDays || [];
  day ??= days[0];
  const ov = document.createElement('div');
  ov.className = 'overlay';
  if (!day) {
    ov.innerHTML = `<div class="raven"><button class="x">✕</button><div class="mast"><h1>The Raven</h1></div><p style="margin-top:14px">The first Raven flies at the crowning, 00:00 UTC. Make some news before then: the editors are watching.</p></div>`;
  } else {
    let r;
    try { r = await api('/api/raven/' + day); } catch (e) { return fail(e); }
    Object.assign(S.names, r.names);
    const story = s => `<div class="story"><h3>${esc(s.headline)}</h3><p>${esc(s.body)}</p></div>`;
    const i = days.indexOf(day);
    ov.innerHTML = `<div class="raven"><button class="x">✕</button>
      <div class="mast"><h1>The Raven</h1><div class="meta"><span>Day ${day} of the Chog World Order</span><span>${esc(r.tagline)}</span><span>Price: 1 gas</span></div></div>
      <div class="tally"><span>🗡 <b>${r.stats.stabs}</b> stabbings</span><span>🔔 <b>${r.stats.shames}</b> shames</span><span>💒 <b>${r.stats.weddings}</b> weddings</span><span>🍼 <b>${r.stats.heirs}</b> heirs</span><span>🍗 <b>${r.stats.feasts}</b> feasts</span></div>
      ${r.lead ? `<div class="lead"><div><h2>${esc(r.lead.headline)}</h2><p>${esc(r.lead.body)}</p></div><img src="${art(r.lead.a, true)}" alt=""></div>` : ''}
      <div class="cols">${r.stories.slice(0, 4).map(story).join('')}
        ${r.king ? `<div class="story"><h3>👑 On the Iron Toilet: ${esc(nm(r.king))}</h3><p>${r.hand ? `Hand of the Chog: ${esc(nm(r.hand))}.` : ''} Long may they sit.</p></div>` : ''}
        ${r.rumors.length ? `<div class="story"><h3>Whispers from the privy</h3>${r.rumors.slice(0, 2).map(x => `<p class="rumor">${esc(x)}</p>`).join('')}</div>` : ''}</div>
      <div class="quote">“${esc(r.quote)}”</div>
      ${r.tx ? `<p class="small" style="text-align:center">Sealed on-chain: <a href="${S.chain?.explorer}/tx/${r.tx}" target="_blank" rel="noopener">${r.tx.slice(0, 12)}… ↗</a></p>` : ''}
      <div class="nav"><button class="btn tiny white" ${i < days.length - 1 ? `data-d="${days[i + 1]}"` : 'disabled'}>◀ Older</button>
        <button class="btn tiny mon" id="share">Share this Raven</button>
        <button class="btn tiny white" ${i > 0 ? `data-d="${days[i - 1]}"` : 'disabled'}>Newer ▶</button></div></div>`;
    ov.querySelector('#share').onclick = () => {
      const text = `${r.lead?.headline || 'THE RAVEN'}\n\nToday in the Game of Chogs. "${r.quote}"`;
      window.open('https://x.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(location.origin + '/#raven/' + day), '_blank');
    };
  }
  document.body.appendChild(ov);
  sfx('reveal');
  ov.onclick = e => {
    if (e.target === ov || e.target.closest('.x')) return closeOv(ov);
    const d = e.target.closest('[data-d]'); if (d) { ov.remove(); openRaven(+d.dataset.d); }
  };
}

// ---------------------------------------------------------------- settings
function openSettings() {
  $('.overlay.setov')?.remove();
  const ov = document.createElement('div');
  ov.className = 'overlay setov';
  ov.innerHTML = `<div class="card tut settings"><button class="x" aria-label="close">✕</button><h2 class="tag cyan">Settings</h2>
    <label>Doodle portraits<small>Hand-drawn doodle Chogs instead of the real NFT art</small><input type="checkbox" data-p="doodles" ${prefs.doodles ? 'checked' : ''}></label>
    <label>Shake &amp; wobble<small>Screen shake, hit-freeze and bobbing</small><input type="checkbox" data-p="shake" ${prefs.shake ? 'checked' : ''}></label>
    <label>Sound effects<input type="range" min="0" max="1" step="0.05" data-p="sfx" value="${prefs.sfx}"></label>
    <label>Music<input type="range" min="0" max="1" step="0.05" data-p="music" value="${prefs.music}"></label>
    <div style="display:flex;gap:8px;justify-content:space-between;margin-top:14px"><button class="btn white" id="sethow">How to play</button><button class="btn pink" id="setok">Done</button></div></div>`;
  document.body.appendChild(ov);
  ov.oninput = e => {
    const el = e.target.closest('[data-p]'); if (!el) return;
    const k = el.dataset.p, v = el.type === 'checkbox' ? el.checked : +el.value;
    setPref(k, v);
    if (k === 'doodles') rerenderAll();
    if (k === 'sfx') sfx('tick');
  };
  ov.onclick = e => {
    if (e.target === ov || e.target.closest('.x') || e.target.id === 'setok') return closeOv(ov);
    if (e.target.id === 'sethow') { ov.remove(); openTutorial(); }
  };
}

// ---------------------------------------------------------------- tutorial
const TUT = [
  ['👑', 'Winter Is Chogging', 'Every Chog in the collection is a noble. Climb the clout ladder and sit on the <b>Iron Toilet</b>.'],
  ['🗡', '3 Gas a Day', 'Tap any Chog to <b>stab</b>, <b>duel</b>, <b>propose</b> or <b>kneel</b>. Fail a stab and you do the walk of shame.'],
  ['⛓', 'The Chain Remembers', 'Titles, scars, spouses and heirs stick to the NFT. At midnight UTC a king is crowned and the realm is sealed on Monad.'],
];
function openTutorial(i = 0) {
  $('.overlay.tutov')?.remove();
  const ov = document.createElement('div');
  ov.className = 'overlay tutov';
  ov.innerHTML = `<div class="card tut"><div class="em">${TUT[i][0]}</div><h2 class="tag pink">${TUT[i][1]}</h2><p>${TUT[i][2]}</p>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px"><div class="dots">${TUT.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
    <button class="btn ${i === TUT.length - 1 ? 'pink' : ''}">${i === TUT.length - 1 ? 'Let me stab' : 'Next'}</button></div></div>`;
  document.body.appendChild(ov);
  ov.querySelector('.btn').onclick = () => { ov.remove(); if (i < TUT.length - 1) openTutorial(i + 1); else { try { localStorage.setItem('goc:tut', '1'); } catch {} sfx('fart'); } };
}
window.__tut = () => openTutorial();

// ---------------------------------------------------------------- boot
(async function boot() {
  document.addEventListener('pointerdown', unlock, { once: true });
  api('/api/chain').then(c => { S.chain = c; }).catch(() => {});
  const s = restore();
  if (s) {
    try { await loadMe(); if (S.me.length) return enter(); } catch (e) { if (e.status === 401) logout(); }
  }
  gate();
  if (location.hash.startsWith('#raven/')) { S.spectator = true; enter(); setTimeout(() => openRaven(+location.hash.slice(7)), 500); }
})();
