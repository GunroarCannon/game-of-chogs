// Game of Chogs client: the gate, the court, the map, moves with explosions, the Raven, the ticker.
import './style.css';
import { api, authed } from './api.js';
import { listWallets, connectInjected, connectBurner, restore, logout, walletKind } from './wallet.js';
import { unlock, sfx, setMuted, isMuted, startMusic } from './sound.js';
import { burst, shake, centerOf } from './fx.js';
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
const art = (key) => `/art/${key}.svg`;
const portraitOf = n => n.kind === 'genesis' ? `/img/${n.id}` : art(n.key);
const mine = k => S.me.some(n => n.key === k);
const current = () => S.me.find(n => n.key === S.cur) || S.me[0] || null;
function toast(html, err = false, ms = 3800) {
  let box = $('#toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
  const t = document.createElement('div');
  t.className = 'card notape toast' + (err ? ' err' : '');
  t.innerHTML = html;
  box.appendChild(t);
  setTimeout(() => t.remove(), ms);
}
const fail = e => { toast(esc(e.message || e), true); sfx('fart'); };

function portraitHTML(n) {
  const f = n.flags || {};
  if (n.kind === 'genesis') return `<div class="portrait ${f.rugged ? 'rugged' : ''} ${f.king ? 'king' : ''}" style="background-image:url('${art(n.key)}')"><img src="${portraitOf(n)}" alt="${esc(n.name)}" loading="lazy">${stickersOnly(n)}</div>`;
  return `<div class="portrait ${f.king ? 'king' : ''}"><img src="${chogDataURL(n.traits, f)}" alt="${esc(n.name)}"></div>`;
}
/** Stickers alone (no Chog): a transparent layer over real Genesis art. */
function stickersOnly(n) {
  const f = n.flags || {};
  if (!Object.values(f).some(Boolean)) return '';
  return `<img class="over" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(stickerLayerSVG(f))}" alt="">`;
}

// ---------------------------------------------------------------- gate
function gate() {
  document.title = 'Game of Chogs';
  const demo = ['g:7', 'g:420', 'g:69'];
  app.innerHTML = `<div id="gate">
    <h1 class="title tag"><span>GAME</span><span class="of">of</span><span class="pink tag">CHOGS</span></h1>
    <div class="quote" id="gq">“${esc(pick(QUOTES))}”</div>
    <div class="gate-chogs">${demo.map(k => `<img src="${art(k)}" alt="">`).join('')}</div>
    <div class="gate-doors">
      <div class="card door"><h3>I HOLD A CHOG</h3><p>Your Chog Genesis NFT is a noble. Its stats come from its traits, and its titles, scars, spouse and heirs are saved to the token. Sell it and the buyer inherits the whole bloody reputation.</p>
        <div id="wallets" style="display:grid;gap:8px"></div></div>
      <div class="card door"><h3>NO CHOG?</h3><p>Claim a free <b>Chog Snow</b>: a bastard NFT, minted gaslessly to your wallet (or a burner, if you have none). Bastards are weaker. Bastards also have nothing to lose.</p>
        <button class="btn pink big" id="bastard">CLAIM A BASTARD</button></div>
      <div class="card door"><h3>JUDGES START HERE</h3><p id="judgep">Grab a testnet Chog Genesis (the same art and traits as the real ones) and play the full holder flow in 30 seconds. No MON needed.</p>
        <button class="btn cyan big" id="faucet">GET A TEST CHOG</button>
        <button class="btn white" id="watch">JUST WATCH</button></div>
    </div>
    <p class="small muted" style="margin-top:26px;text-align:center;max-width:620px">Logging in is one free signature (an oath). No gas, no approvals. Built for Chogathon 2026 on Monad.</p>
  </div>`;
  setInterval(() => { const q = $('#gq'); if (q) q.textContent = `“${pick(QUOTES)}”`; }, 5200);
  const ws = listWallets();
  $('#wallets').innerHTML = ws.length
    ? ws.map((w, i) => `<button class="btn mon" data-w="${i}">${w.icon ? `<img src="${w.icon}" width="20" height="20" alt="">` : ''}CONNECT ${esc(w.name)}</button>`).join('')
    : `<p class="small"><b>No wallet found.</b> Install Rabby, MetaMask, Phantom or Backpack, or claim a bastard instead.</p>`;
  $('#wallets').onclick = e => { const b = e.target.closest('[data-w]'); if (b) go(() => connectInjected(ws[+b.dataset.w].provider), 'holder'); };
  $('#bastard').onclick = () => go(() => ws.length ? connectInjected(ws[0].provider) : connectBurner(), 'bastard');
  $('#faucet').onclick = () => go(() => ws.length ? connectInjected(ws[0].provider) : connectBurner(), 'faucet');
  $('#watch').onclick = () => { unlock(); S.spectator = true; enter(); };
  api('/api/chain').then(c => {
    S.chain = c;
    if (c.mode === 'mainnet' && !c.faucet) { $('#faucet').classList.add('hidden'); $('#judgep').textContent = 'Have a look around first: the realm, the throne, the Raven. Then claim a bastard to play.'; }
  }).catch(() => {});
}

async function go(connect, intent) {
  unlock(); sfx('tick');
  try {
    await connect();
    if (intent === 'bastard') await api('/api/bastard', {}).catch(e => { if (!/One bastard/.test(e.message)) throw e; });
    if (intent === 'faucet') { const r = await api('/api/faucet', {}); toast(`Minted <b>${esc(r.name)}</b> to your wallet on Monad testnet. It is yours now.`); }
    await loadMe();
    if (!S.me.length) {
      toast('No Chog Genesis in this wallet. Claim a bastard, or grab a test Chog.', true, 6000);
      return;
    }
    enter();
  } catch (e) { fail(e); }
}

// ---------------------------------------------------------------- game shell
let map, realm, pollT;
function enter() {
  app.innerHTML = `<div id="game" data-tab="map">
    <header id="topbar">
      <div class="logo tag" id="logo">GAME OF <span class="pink tag">CHOGS</span></div>
      <div class="throne-chip" id="throne" title="The Iron Toilet"></div>
      <div class="spacer"></div>
      <button class="btn tiny white" id="ravenbtn">📰 THE RAVEN</button>
      <div class="daybox"><b id="dayn">DAY ?</b><br><span id="countdown"></span></div>
      <button class="btn tiny white" id="mute">${isMuted() ? '🔇' : '🔊'}</button>
      <button class="btn tiny white" id="who"></button>
    </header>
    <aside class="side" id="left"></aside>
    <div id="mapwrap"><canvas id="map"></canvas><div class="maphint">drag · scroll to zoom · click a House or a Chog</div>
      <div class="mapzoom"><button class="btn tiny white" id="zin">+</button><button class="btn tiny white" id="zout">−</button></div></div>
    <aside class="side" id="right"></aside>
    <footer id="ticker"><div class="track" id="track"></div></footer>
    <nav id="mobnav"><button data-t="map" class="on">🗺 MAP</button><button data-t="me">🐗 ME</button><button data-t="court">🗡 COURT</button><button data-t="raven">📰 RAVEN</button></nav>
  </div>`;
  $('#mute').onclick = () => { setMuted(!isMuted()); $('#mute').textContent = isMuted() ? '🔇' : '🔊'; };
  $('#ravenbtn').onclick = () => openRaven();
  $('#logo').onclick = () => openTutorial();
  $('#who').textContent = S.spectator ? 'PLAY' : (walletKind() === 'burner' ? 'BURNER ' : '') + (S.address || '').slice(0, 6) + '…';
  $('#who').onclick = () => { if (S.spectator || confirm('Log out?')) { logout(); location.reload(); } };
  $('#mobnav').onclick = e => {
    const b = e.target.closest('[data-t]'); if (!b) return;
    if (b.dataset.t === 'raven') return openRaven();
    $('#game').dataset.tab = b.dataset.t;
    for (const x of $('#mobnav').children) x.classList.toggle('on', x === b);
    if (b.dataset.t === 'map') map?.fit();
  };
  realm ||= buildRealm();
  map = new ChogMap($('#map'), realm, {
    onPickHouse: h => { S.tab = 'house:' + h.id; renderRight(); toast(`<b>House ${esc(h.name)}</b>: “${esc(h.words)}”`); if (innerWidth <= 900) $('#mobnav [data-t=court]').click(); },
    onPickPin: p => openNoble(p.key),
  });
  $('#zin').onclick = () => map.zoom(1.3); $('#zout').onclick = () => map.zoom(1 / 1.3);
  renderLeft(); renderRight();
  poll(true);
  clearInterval(pollT); pollT = setInterval(() => poll(), 6000);
  setInterval(countdown, 1000);
  try { if (!localStorage.getItem('goc:tut') && !S.spectator) openTutorial(); else whileYouSlept(); } catch {}
  startMusic();
}

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
  ov.innerHTML = `<div class="card tut"><h2 class="tag pink">WHILE YOU SLEPT…</h2>
    <div class="rel">${news.slice(-10).reverse().map(e => `<div>${esc(evText(e))} <span class="muted">· day ${e.day}</span></div>`).join('')}</div>
    ${foes.length ? `<p><b>The Chain remembers.</b> Revenge on them is +15% for 3 days.</p><div style="display:flex;gap:6px;flex-wrap:wrap">${foes.map(f => `<button class="btn tiny red" data-k="${f}">🗡 ${esc(nm(f))}</button>`).join('')}</div>` : ''}
    <div style="text-align:right;margin-top:12px"><button class="btn" id="wysok">FINE. I'M AWAKE.</button></div></div>`;
  document.body.appendChild(ov);
  sfx(foes.length ? 'shame' : 'reveal');
  ov.onclick = e => {
    if (e.target === ov || e.target.id === 'wysok') return ov.remove();
    const b = e.target.closest('[data-k]'); if (b) { ov.remove(); openNoble(b.dataset.k); }
  };
}

function countdown() {
  if (!S.world) return;
  const ms = S.world.nextTick - Date.now();
  const h = Math.floor(ms / 3600e3), m = Math.floor(ms / 60e3) % 60, s = Math.floor(ms / 1e3) % 60;
  $('#countdown') && ($('#countdown').textContent = ms > 0 ? `coronation in ${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s` : 'the raven is flying…');
}

async function loadMe() {
  const r = await api('/api/me');
  S.address = r.address; S.me = r.nobles; S.proposals = r.proposals; Object.assign(S.names, r.names);
  if (!S.cur || !mine(S.cur)) S.cur = S.me[0]?.key || null;
  S.spectator = false;
}

async function poll(first = false) {
  try {
    const [w, roster] = await Promise.all([api('/api/world?since=' + (first ? Math.max(0, S.seq - 40) : S.seq)), first || Math.random() < 0.35 ? api('/api/roster') : null]);
    const fresh = first ? [] : w.events;
    S.world = w; Object.assign(S.names, w.names);
    if (roster) S.roster = roster;
    if (first) S.feed = w.events.slice(-40); else S.feed = [...(S.feed || []), ...w.events].slice(-40);
    S.seq = w.seq;
    $('#dayn').textContent = 'DAY ' + w.day;
    renderThrone(); renderTicker(); renderPins(); countdown();
    if (S.tab === 'feasts') renderRight();
    let hitMe = false;
    for (const e of fresh) {
      const loc = e.b && pinPos(e.b);
      if (loc) map.pulse(loc[0], loc[1], /stab|kingslayer|red_wedding|oathbreak/.test(e.type) ? '#ff3b3b' : /marry|beget/.test(e.type) ? '#ff2e88' : '#ffe14d');
      if (mine(e.b) && !mine(e.a)) { hitMe = true; toast(`<b>${esc(evText(e))}</b>`, /stab_win|kingslayer|oathbreak|duel_win|red_wedding/.test(e.type) && e.b !== e.a); if (/stab_win|kingslayer/.test(e.type)) { sfx('hit'); shake(); } }
      if (e.type === 'crown') sfx('fanfare');
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
  const t = S.world.throne, k = t.king;
  $('#throne').innerHTML = k ? `<img src="${art(k)}" alt=""><div><b>👑 ${esc(nm(k))}</b><small>sits the Iron Toilet${t.hand ? ` · Hand: ${esc(nm(t.hand))}` : ''}</small></div>` : '';
  $('#throne').onclick = () => k && openNoble(k);
}

// ---------------------------------------------------------------- left: my chog
function renderLeft() {
  const L = $('#left'); if (!L) return;
  const n = current();
  if (!n) {
    L.innerHTML = `<div class="card me"><h2>SPECTATING</h2><p class="small" style="font-family:var(--plain)">You are watching the realm. Read the Raven, stalk the roster, judge everyone silently.</p>
      <button class="btn pink" id="joinb" style="width:100%">CLAIM A BASTARD</button></div>${aboutHTML()}`;
    $('#joinb').onclick = () => go(() => listWallets().length ? connectInjected(listWallets()[0].provider) : connectBurner(), 'bastard');
    return;
  }
  const h = houseById(n.house), maxStat = 14;
  L.innerHTML = `${S.me.length > 1 ? `<div class="switcher">${S.me.map(m => `<img src="${art(m.key)}" data-k="${m.key}" class="${m.key === n.key ? 'on' : ''}" title="${esc(m.name)}" alt="">`).join('')}</div>` : ''}
    <div class="card me" id="mecard">
      ${portraitHTML(n)}
      <h2>${esc(n.name)}</h2>
      <div class="housebar"><span class="sw" style="background:${h.color}"></span>HOUSE ${esc(h.name.toUpperCase())} · ${esc(n.tier)}${n.kind === 'bastard' ? ' · BASTARD' : ''}</div>
      <div class="small muted" style="font-style:italic">“${esc(h.words)}”</div>
      <div class="clout"><span>CLOUT <span class="small">#${n.rank}</span></span><b>${n.clout}</b></div>
      <div class="gas">${[0, 1, 2].map(i => `<span class="pip ${i < n.gas ? '' : 'off'}" title="gas">💨</span>`).join('')}<span class="small under">&nbsp;${n.gas} GAS LEFT TODAY</span></div>
      ${n.flags.rugged ? `<div class="chip" style="background:var(--red);color:#fff">☠ RUGGED UNTIL TOMORROW</div>` : ''}
      ${!n.adult ? `<div class="chip" style="background:var(--cyan)">🍼 STILL A CHOGLING</div>` : ''}
      <div class="stats">${[['cunning', 'CUNNING 🗡'], ['might', 'MIGHT ⚔'], ['charm', 'CHARM 💋']].map(([k, l]) => `<div class="stat"><span>${l}</span><span class="bar"><i style="width:${Math.min(100, n.stats[k] / maxStat * 100)}%"></i></span><b>${n.stats[k]}</b></div>`).join('')}</div>
      ${n.titles.length ? `<div class="titles">${n.titles.map(t => `<span class="chip" title="${esc(TITLES[t]?.desc)}">🏅 ${esc(TITLES[t]?.name || t)}</span>`).join('')}</div>` : ''}
      <div class="rel" style="margin-top:10px">${relHTML(n)}</div>
      ${n.streak > 1 ? `<div class="small under" style="margin-top:6px">🌙 NIGHT'S WATCH STREAK: ${n.streak} DAYS</div>` : ''}
      ${n.tx ? `<div class="small" style="margin-top:6px"><a href="${S.chain?.explorer}/tx/${n.tx}" target="_blank" rel="noopener">minted on-chain ↗</a></div>` : ''}
    </div>
    <div class="inbox">${S.proposals.filter(p => p.to === n.key).map(p => `<div class="card notape"><b>💍 ${esc(nm(p.from))}</b> wants to marry you.
      <div style="display:flex;gap:6px;margin-top:8px"><button class="btn tiny lime" data-yes="${p.from}">I DO</button><button class="btn tiny red" data-no="${p.from}">EW, NO</button><button class="btn tiny white" data-k="${p.from}">WHO?</button></div></div>`).join('')}</div>
    <div class="section-h tag cyan">SOLO MOVES</div>
    <div class="moves">${['feast', 'beget'].map(m => moveBtn(m, n, null)).join('')}</div>
    <div class="section-h tag pink">THE CHAIN REMEMBERS</div>
    <div class="rel">${Object.keys(n.grudges || {}).length ? Object.keys(n.grudges).map(k => `<div>🩸 <a data-k="${k}">${esc(nm(k))}</a> wronged you. Revenge is +15% until day ${n.grudges[k]}.</div>`).join('') : '<span class="muted">Nobody has wronged you lately. Suspicious.</span>'}</div>
    <div class="section-h tag">RECENTLY</div>
    <div class="log" style="border:0;color:var(--paper)">${(n.log || []).slice().reverse().map(e => `<div>${esc(evText(e))}</div>`).join('') || '<span class="muted">Nothing yet. Go stab someone.</span>'}</div>
    ${aboutHTML()}`;
  L.onclick = e => {
    const t = e.target;
    if (t.dataset.k && t.tagName === 'IMG' && t.closest('.switcher')) { S.cur = t.dataset.k; renderLeft(); renderPins(); return; }
    if (t.dataset.k) return openNoble(t.dataset.k);
    if (t.dataset.yes || t.dataset.no) return answer(t.dataset.yes || t.dataset.no, !!t.dataset.yes);
    const mv = t.closest('[data-move]'); if (mv) doMove(mv.dataset.move, null, mv);
  };
}
const aboutHTML = () => `<p class="small muted" style="margin-top:24px;font-family:var(--plain)">Every noble is an NFT. Moves resolve instantly; the throne, the Raven and the on-chain seal happen at the daily coronation (00:00 UTC). ${S.chain ? `Chain: <b>${S.chain.mode}</b>${S.chain.ledger ? ` · <a href="${S.chain.explorer}/address/${S.chain.ledger}" target="_blank" rel="noopener">ledger ↗</a>` : ''}` : ''} · <a href="#" onclick="event.preventDefault();window.__tut()">how to play</a></p>`;
function relHTML(n) {
  const a = (k, emoji, label) => k ? `<div>${emoji} ${label} <a data-k="${k}">${esc(nm(k))}</a></div>` : '';
  return a(n.spouse, '💍', 'Married to') + a(n.liege, '🧎', 'Sworn to')
    + (n.vassals?.length ? `<div>🛡 Vassals: ${n.vassals.map(k => `<a data-k="${k}">${esc(nm(k))}</a>`).join(', ')}</div>` : '')
    + (n.heirs?.length ? `<div>🍼 Heirs: ${n.heirs.map(k => `<a data-k="${k}">${esc(nm(k))}</a>`).join(', ')}</div>` : '')
    + (n.parents ? `<div>🧬 Child of ${n.parents.map(k => `<a data-k="${k}">${esc(nm(k))}</a>`).join(' & ')}</div>` : '')
    + (n.lords?.length > 1 ? `<div>📜 ${n.lords.length} lords have owned this Chog</div>` : '');
}
function moveBtn(m, a, b) {
  const M = MOVES[m];
  let sub = M.blurb;
  if (b && M.target && ['stab', 'duel', 'propose'].includes(m) && S.world) {
    const w = { day: S.world.day, throne: S.world.throne, nobles: {} };
    const full = x => ({ ...x, grudges: x.grudges || {}, stats: x.stats });
    try { sub = `${Math.round(odds({ ...w, nobles: Object.fromEntries(S.roster.map(r => [r[0], { key: r[0], clout: r[3] }])) }, full(a), m, full(b)) * 100)}% odds · ${M.blurb}`; } catch {}
  }
  const color = { stab: 'red', duel: 'mon', feast: 'lime', propose: 'pink', beget: 'cyan', knee: 'white' }[m];
  return `<button class="btn ${color}" data-move="${m}" ${a.gas < M.gas || a.flags?.rugged ? 'disabled' : ''}>${M.label} <span class="small">${'💨'.repeat(M.gas)}</span><small>${esc(sub)}</small></button>`;
}

// ---------------------------------------------------------------- right: the court
function renderRight() {
  const R = $('#right'); if (!R) return;
  const tabs = [['top', '🏆 TOP'], ['enemies', '🩸 ENEMIES'], ['feasts', '🍗 FEASTS'], ['players', '🔥 PLAYERS'], ['houses', '🏰 HOUSES']];
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
    body = fs.length ? fs.map(f => `<div class="card notape" style="padding:12px;margin:10px 0"><b>🍗 ${esc(f.hostName)}</b> is feasting. ${f.guests.length} guests.
      <div class="small muted">Ends in ${Math.max(0, Math.round((f.until - Date.now()) / 60e3))} min. Guests gain clout. Enemies at the same table may cause a Red Wedding.</div>
      <div style="display:flex;gap:6px;margin-top:8px">${me && !mine(f.host) && !f.guests.includes(me.key) ? `<button class="btn tiny lime" data-rsvp="${f.id}">ATTEND (FREE)</button>` : ''}<button class="btn tiny white" data-k="${f.host}">HOST</button></div></div>`).join('')
      : `<p class="muted">No feasts right now. Throw one: it costs 1 gas and the guests bring you clout.</p>`;
  } else if (S.tab === 'houses' && !S.q) {
    body = HOUSES.map(h => { const ms = S.roster.filter(r => r[2] === h.id); const total = ms.reduce((s, r) => s + r[3], 0);
      return `<div class="row" data-house="${h.id}"><span class="rk"></span><span style="width:44px;height:44px;border:2px solid #000;border-radius:10px;background:${h.color}"></span><span class="nm">HOUSE ${esc(h.name.toUpperCase())}<small>“${esc(h.words)}” · ${ms.length} Chogs</small></span><span class="cl">${total}</span></div>`; }).join('');
  } else {
    body = rows.slice(0, 80).map(r => `<div class="row ${r[5] ? 'rugged' : ''} ${mine(r[0]) ? 'mine' : ''}" data-k="${r[0]}"><span class="rk">#${rank.get(r[0])}</span><img src="${art(r[0])}" loading="lazy" alt=""><span class="nm">${esc(r[1])}${r[0] === S.world?.throne?.king ? ' 👑' : ''}<small>${esc(houseById(r[2]).name.toUpperCase())}${r[4] ? ' · PLAYER' : ''}${r[5] ? ' · RUGGED' : ''}${r[7] ? ' · 💍' : ''}</small></span><span class="cl">${r[3]}</span></div>`).join('')
      || `<p class="muted">${!S.roster ? 'Summoning the court…' : S.tab === 'enemies' ? 'No enemies yet. Make some.' : 'Nobody here.'}</p>`;
  }
  R.innerHTML = `<div class="section-h tag" style="margin-top:0">THE COURT</div>
    <input class="search" id="q" placeholder="Search a Chog (name or #)…" value="${esc(S.q)}">
    <div class="tabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${S.tab === k ? 'on' : ''}">${l}</button>`).join('')}${S.tab.startsWith('house:') ? `<button class="on">HOUSE ${esc(houseById(S.tab.slice(6)).name.toUpperCase())}</button>` : ''}</div>
    <div id="rows">${body}</div>`;
  const q = $('#q');
  q.oninput = () => { S.q = q.value.trim(); const pos = q.selectionStart; renderRight(); const nq = $('#q'); nq.focus(); nq.setSelectionRange(pos, pos); };
  R.onclick = e => {
    const t = e.target.closest('[data-tab],[data-k],[data-rsvp],[data-house]'); if (!t) return;
    if (t.dataset.tab) { S.tab = t.dataset.tab; S.q = ''; return renderRight(); }
    if (t.dataset.house) { S.tab = 'house:' + t.dataset.house; return renderRight(); }
    if (t.dataset.rsvp) return attend(+t.dataset.rsvp);
    openNoble(t.dataset.k);
  };
}

// ---------------------------------------------------------------- ticker + event text
function evText(e) {
  const a = nm(e.a), b = nm(e.b);
  switch (e.type) {
    case 'stab_win': return `🗡 ${a} stabbed ${b} (+${e.n} clout)`;
    case 'stab_fail': return `🔔 ${a} tried to stab ${b} and got caught. SHAME!`;
    case 'kingslayer': return `👑🗡 ${a} STABBED THE KING, ${b}!`;
    case 'oathbreak': return `🐍 ${a} betrayed their liege ${b}`;
    case 'duel_win': return `⚔ ${a} beat ${b} in a duel`;
    case 'feast': return `🍗 ${a} is throwing a feast${e.n ? ` (${e.n} guests)` : ''}`;
    case 'red_wedding': return `🩸 RED WEDDING at ${a}'s feast!`;
    case 'propose': return `💍 ${a} proposed to ${b}`;
    case 'marry': return `💒 ${a} married ${b}`;
    case 'propose_reject': return `💔 ${b} rejected ${a}`;
    case 'beget': return `🍼 ${a} & ${b} begot ${nm(e.heir)}`;
    case 'knee': return `🧎 ${a} bent the knee to ${b}`;
    case 'crown': return `👑 ${a} now sits the Iron Toilet`;
    case 'rugged': return `☠ ${a} got rugged${e.b ? ` by ${b}` : ''}`;
    case 'claim': return `🔥 ${a} has awoken: a holder has claimed them`;
    case 'new_lord': return `💰 ${a} has a new lord. The realm takes note.`;
    case 'bastard': return `🐣 ${a} crawled into the realm`;
    case 'streak': return `🌙 ${a} has manned the Watch ${e.n} days running`;
    case 'title': return `🏅 ${a} earned "${TITLES[e.title]?.name || e.title}"`;
    default: return `${a} did something`;
  }
}
function renderTicker() {
  const t = $('#track'); if (!t) return;
  const evs = (S.feed || []).slice(-25).reverse();
  const html = evs.map(e => `<span data-k="${e.a}">${esc(evText(e)).replace(/(SHAME!|STABBED THE KING|RED WEDDING)/, '<b>$1</b>')}</span>`).join('') || '<span>The realm is quiet. Too quiet.</span>';
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
  ov.className = 'overlay';
  ov.innerHTML = `<div class="card sheet">
    <button class="x" aria-label="close">✕</button>
    <div>${portraitHTML(n)}
      <div class="titles">${n.titles.map(t => `<span class="chip" title="${esc(TITLES[t]?.desc)}">🏅 ${esc(TITLES[t]?.name || t)}</span>`).join('')}</div></div>
    <div>
      <h2>${esc(n.name)}</h2>
      <div class="housebar"><span class="sw" style="background:${h.color}"></span>HOUSE ${esc(h.name.toUpperCase())} · ${esc(n.tier)} · RANK #${n.rank}${n.claimed ? ' · 🔥 PLAYER' : ' · 🤖 UNCLAIMED'}</div>
      <div class="clout"><span>CLOUT</span><b>${n.clout}</b></div>
      <div class="stats">${[['cunning', 'CUNNING 🗡'], ['might', 'MIGHT ⚔'], ['charm', 'CHARM 💋']].map(([k, l]) => `<div class="stat"><span>${l}</span><span class="bar"><i style="width:${Math.min(100, n.stats[k] / 14 * 100)}%"></i></span><b>${n.stats[k]}</b></div>`).join('')}</div>
      <div class="rel">${relHTML(n)}${Object.keys(n.grudges).length ? `<div>🩸 Holds grudges against: ${Object.keys(n.grudges).map(k => `<a data-k="${k}">${esc(nm(k))}</a>`).join(', ')}</div>` : ''}</div>
      ${me && !self && !S.spectator ? `<div class="section-h tag pink" style="margin-top:12px;font-size:1.2rem">AS ${esc(me.name.toUpperCase())} (${me.gas} 💨)</div>
        <div class="moves">${['stab', 'duel', 'propose', 'knee'].map(m => moveBtn(m, me, n)).join('')}</div>` : ''}
      ${S.spectator ? `<p class="small" style="font-family:var(--plain)">Claim a bastard to stab this Chog.</p>` : ''}
      <div class="log">${n.log.slice().reverse().map(e => `<div>${esc(evText(e))} <span class="muted">· day ${e.day}</span></div>`).join('') || '<span class="muted">A quiet life. For now.</span>'}</div>
      ${n.kind === 'genesis' ? `<div class="small" style="margin-top:8px"><a href="https://opensea.io/item/monad/0xc96d31f8626c6d03fae5dcd3d61e3fb9f4a73763/${n.id}" target="_blank" rel="noopener">view NFT on OpenSea ↗</a></div>` : `<div class="small" style="margin-top:8px"><a href="/meta/${n.kind}/${n.id}" target="_blank" rel="noopener">live NFT metadata ↗</a></div>`}
    </div></div>`;
  document.body.appendChild(ov);
  sfx('swoosh');
  const close = () => ov.remove();
  ov.onclick = e => {
    if (e.target === ov || e.target.closest('.x')) return close();
    const k = e.target.dataset?.k; if (k) { close(); return openNoble(k); }
    const mv = e.target.closest('[data-move]'); if (mv) { close(); doMove(mv.dataset.move, n, mv); }
  };
}

// ---------------------------------------------------------------- moves + the slam
const WORDS = { stab_win: 'SHANKED!', stab_fail: 'SHAME!', kingslayer: 'KINGSLAYER!', oathbreak: 'BETRAYAL!', duel_win: 'VICTORY!', duel_lose: 'REKT!', feast: 'FEAST!',
  red_wedding: 'RED WEDDING!', marry: 'WED!', propose_reject: 'REJECTED!', propose: 'PROPOSED!', beget: 'CHOGLING!', knee: 'SWORN!' };
async function doMove(move, target, btn) {
  const me = current(); if (!me) return;
  if (btn) { const [x, y] = centerOf(btn); burst(x, y, 'gas', 0.5); }
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
  const word = WORDS[kind] || 'DONE!';
  const toastKey = { stab_win: 'stab_win', kingslayer: 'stab_win', oathbreak: 'stab_win', stab_fail: 'stab_fail', duel_win: 'duel_win', duel_lose: 'duel_lose', feast: 'feast', red_wedding: 'feast', marry: 'propose', propose: 'propose', propose_reject: 'propose', beget: 'beget', knee: 'knee' }[kind];
  const line = r.boom ? 'The feast exploded into a Red Wedding. Everyone at the table loses clout. You get a title.' : pick(TOASTS[toastKey] || ['It is done.']);
  const d = me.clout - before;
  const ov = document.createElement('div');
  ov.id = 'slam';
  const loser = (kind === 'stab_win' || kind === 'kingslayer' || kind === 'duel_win' || kind === 'oathbreak') ? 'b' : (kind === 'stab_fail' || kind === 'duel_lose') ? 'a' : '';
  const right = target ? art(target.key) : r.heir ? art(r.heir.key) : null;
  ov.innerHTML = `<div class="vs"><img class="a ${loser === 'a' ? 'loser' : ''}" src="${art(me.key)}" alt="">${right ? `<img class="b ${loser === 'b' ? 'loser' : ''}" src="${right}" alt="">` : ''}</div>
    <div class="word tag ${/SHAME|REKT|REJECTED/.test(word) ? 'cyan' : /RED|KING|BETRAY/.test(word) ? 'pink' : ''}">${word}</div>
    <div class="line">${esc(line)}</div>
    ${r.heir ? `<div class="line">Say hello to <b>${esc(r.heir.name)}</b>, a Chogling NFT. It grows up in 2 days.</div>` : ''}
    <div class="delta">CLOUT <b class="${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '+' : ''}${d}</b> · ${me.gas} 💨 LEFT</div>
    <div class="stamps">${(r.titles || []).map(t => `<div class="stamp">${esc(TITLES[t]?.name || t)}</div>`).join('')}</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center"><button class="btn big" id="carry">CARRY ON</button><button class="btn big mon" id="brag">BRAG ON X</button></div>`;
  document.body.appendChild(ov);
  ov.querySelector('#brag').onclick = () => {
    const what = { stab_win: `just SHANKED ${target ? nm(target.key) : 'someone'} 🗡`, kingslayer: `just STABBED THE KING 👑🗡`, stab_fail: `got caught mid-stab and did the walk of shame 🔔`, duel_win: `won a duel ⚔`, duel_lose: `lost a duel and is now wearing a bandage`,
      red_wedding: `threw a feast that turned into a RED WEDDING 🩸`, feast: `is throwing a feast 🍗`, marry: `just got married 💒`, propose_reject: `got rejected 💔`, beget: `just begot a Chogling 🍼`, knee: `bent the knee 🧎`, oathbreak: `betrayed their liege 🐍` }[kind] || 'is scheming';
    window.open('https://x.com/intent/tweet?text=' + encodeURIComponent(`My Chog ${what} in the Game of Chogs.

"${pick(QUOTES)}"

@ChogNFT #Chogathon`) + '&url=' + encodeURIComponent(location.origin), '_blank');
  };
  const cx = innerWidth / 2, cy = innerHeight * 0.36;
  setTimeout(() => {
    if (/stab_win|kingslayer|oathbreak/.test(kind)) { burst(cx, cy, 'boom', 1.3); burst(cx + 80, cy, 'blood', 0.8); sfx('boom'); sfx('hit'); shake(ov); }
    else if (kind === 'stab_fail') { sfx('bell'); setTimeout(() => sfx('bell'), 900); setTimeout(() => sfx('shame'), 1700); burst(cx, cy, 'gas', 1.2); }
    else if (/duel/.test(kind)) { sfx('hit2'); sfx('boom2'); burst(cx, cy, 'boom', 1); shake(ov); }
    else if (kind === 'red_wedding') { sfx('boom'); setTimeout(() => sfx('far'), 250); burst(cx, cy, 'blood', 2); burst(cx, cy, 'boom', 1.6); shake(ov); }
    else if (/feast|marry|beget/.test(kind)) { sfx(kind === 'beget' ? 'levelup' : 'reveal'); burst(cx, cy, 'confetti', 1.4); if (kind === 'beget') setTimeout(() => sfx('fart'), 500); }
    else if (/reject/.test(kind)) { sfx('shame'); burst(cx, cy, 'gas', 1); }
    else { sfx('swoosh'); burst(cx, cy, 'confetti', 0.8); }
    if (r.titles?.length) setTimeout(() => sfx('fanfare'), 1100);
  }, 280);
  ov.querySelector('#carry').onclick = () => ov.remove();
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
}
async function attend(feastId) {
  const me = current(); if (!me) return;
  try {
    const r = await api('/api/rsvp', { noble: me.key, feast: feastId });
    Object.assign(S.names, r.names);
    S.me = S.me.map(n => n.key === r.me.key ? r.me : n);
    if (r.boom) slam('feast', { boom: r.ev, ev: r.ev, me: r.me, titles: [] }, null, me.clout);
    else { toast('🍗 You ate everything. +1 clout for you, +2 for the host.'); sfx('reveal'); burst(innerWidth / 2, 120, 'confetti', 0.6); }
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
    slam(yes ? 'propose' : 'propose', { ev: r.ev, me: r.me, ok: yes, titles: r.titles || [] }, { key: from }, me.clout);
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
    ov.innerHTML = `<div class="raven"><button class="x">✕</button><div class="mast"><h1>THE RAVEN</h1></div><p style="margin-top:14px">The first Raven flies at the coronation, 00:00 UTC. Make some news before then: the editors are watching.</p></div>`;
  } else {
    let r;
    try { r = await api('/api/raven/' + day); } catch (e) { return fail(e); }
    Object.assign(S.names, r.names);
    const story = s => `<div class="story"><h3>${esc(s.headline)}</h3><p>${esc(s.body)}</p></div>`;
    const i = days.indexOf(day);
    ov.innerHTML = `<div class="raven"><button class="x">✕</button>
      <div class="mast"><h1>THE RAVEN</h1><div class="meta"><span>DAY ${day} OF THE CHOG WORLD ORDER</span><span>${esc(r.tagline)}</span><span>PRICE: 1 GAS</span></div></div>
      <div class="tally"><span>🗡 ${r.stats.stabs} stabbings</span><span>🔔 ${r.stats.shames} walks of shame</span><span>💒 ${r.stats.weddings} weddings</span><span>🍼 ${r.stats.heirs} heirs</span><span>🍗 ${r.stats.feasts} feasts</span></div>
      ${r.lead ? `<div class="lead"><div><h2>${esc(r.lead.headline)}</h2><p>${esc(r.lead.body)}</p></div><img src="${art(r.lead.a)}" alt=""></div>` : ''}
      <div class="cols">${r.stories.map(story).join('')}
        ${r.king ? `<div class="story"><h3>👑 ON THE IRON TOILET: ${esc(nm(r.king))}</h3><p>${r.hand ? `Hand of the Chog: ${esc(nm(r.hand))}.` : ''} Long may they sit.</p></div>` : ''}
        ${r.rumors.length ? `<div class="story"><h3>WHISPERS FROM THE PRIVY</h3>${r.rumors.map(x => `<p class="rumor">${esc(x)}</p>`).join('')}</div>` : ''}</div>
      <div class="quote">“${esc(r.quote)}”</div>
      ${r.tx ? `<p class="small" style="text-align:center">Sealed on-chain: <a href="${S.chain?.explorer}/tx/${r.tx}" target="_blank" rel="noopener">${r.tx.slice(0, 12)}… ↗</a></p>` : ''}
      <div class="nav"><button class="btn tiny white" ${i < days.length - 1 ? `data-d="${days[i + 1]}"` : 'disabled'}>◀ OLDER</button>
        <button class="btn tiny mon" id="share">SHARE THIS RAVEN</button>
        <button class="btn tiny white" ${i > 0 ? `data-d="${days[i - 1]}"` : 'disabled'}>NEWER ▶</button></div></div>`;
    ov.querySelector('#share').onclick = () => {
      const text = `${r.lead?.headline || 'THE RAVEN'}\n\nToday in the Game of Chogs. "${r.quote}"`;
      window.open('https://x.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(location.origin + '/#raven/' + day), '_blank');
    };
  }
  document.body.appendChild(ov);
  sfx('reveal');
  ov.onclick = e => {
    if (e.target === ov || e.target.closest('.x')) return ov.remove();
    const d = e.target.closest('[data-d]'); if (d) { ov.remove(); openRaven(+d.dataset.d); }
  };
}

// ---------------------------------------------------------------- tutorial
const TUT = [
  ['WINTER IS CHOGGING', 'Your Chog is a noble now. Every other Chog in the collection is too: some are played by their holders, the rest scheme on their own. Climb the clout ladder and sit on the <b>Iron Toilet</b>.'],
  ['3 GAS A DAY', 'Each day you get <b>3 gas 💨</b>. Click any Chog (on the map or in the Court) to <b>STAB</b> 🗡, <b>DUEL</b> ⚔, <b>PROPOSE</b> 💍 or <b>BEND THE KNEE</b> 🧎. Throw a <b>FEAST</b> 🍗, or <b>BEGET</b> 🍼 an heir once married. Fail a stab and you do the walk of shame.'],
  ['THE CHAIN REMEMBERS', 'Everything sticks to the NFT: titles, scars, spouse, heirs, grudges. At <b>00:00 UTC</b> the richest Chog is crowned, <b>The Raven</b> prints the day\'s gossip, and it is all sealed on Monad. Come back tomorrow for revenge.'],
];
function openTutorial(i = 0) {
  $('.overlay.tutov')?.remove();
  const ov = document.createElement('div');
  ov.className = 'overlay tutov';
  ov.innerHTML = `<div class="card tut"><h2 class="tag pink">${TUT[i][0]}</h2><p>${TUT[i][1]}</p>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px"><div class="dots">${TUT.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
    <button class="btn ${i === TUT.length - 1 ? 'pink' : ''}">${i === TUT.length - 1 ? 'LET ME STAB' : 'NEXT'}</button></div></div>`;
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
