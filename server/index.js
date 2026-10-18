// Game of Chogs server: owns the one shared world, checks NFT ownership on Monad, resolves moves, ticks daily.
import 'dotenv/config';
import { mirror, flushAll } from './store.js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import { RNG } from '../shared/rng.js';
import { newWorld, genesisNoble, advance, runNpc, npcDueNow, dayOf, checkMove, play, touch, rsvp, answerProposal, makeNoble, displayName, rankOf, isRugged, isAdult, houseById, TITLES, HOUSES } from '../shared/game.js';
import { buildRaven } from '../shared/raven.js';
import { chogSVG } from '../shared/chogArt.js';
import { loginMessage, GENESIS as GENESIS_ADDR } from '../shared/chain.js';
import { ownerOf, refreshOwners, ownersMap, verifyLogin, mintNoble, sealDay, nobleKey, chainInfo, faucetMint } from './chain.js';

const DATA = path.resolve(process.env.DATA_DIR || 'data');
const WORLD = path.join(DATA, 'world.json');
const GENESIS = JSON.parse(fs.readFileSync(path.resolve('data/genesis.json'), 'utf8'));
const SECRET = process.env.SESSION_SECRET || (() => {
  const f = path.join(DATA, 'secret');
  if (!fs.existsSync(f)) fs.writeFileSync(f, crypto.randomBytes(32).toString('hex'));
  return fs.readFileSync(f, 'utf8');
})();

// ---------------------------------------------------------------- world persistence
let W = fs.existsSync(WORLD) ? JSON.parse(fs.readFileSync(WORLD, 'utf8')) : null;
if (W && !W.houseTable) W = null; // worlds from before balanced Houses are rebuilt
if (!W) { W = newWorld(GENESIS, dayOf()); console.log('[world] new world, day', W.day); }
for (const [id, g] of Object.entries(GENESIS)) if (!W.nobles['g:' + id]) W.nobles['g:' + id] = genesisNoble(id, g, W.houseTable); // late metadata
let dirty = true, rosterCache = null;
function save() {
  if (!dirty) return;
  dirty = false; rosterCache = null;
  const json = JSON.stringify(W);
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(WORLD + '.tmp', json); fs.renameSync(WORLD + '.tmp', WORLD);
  mirror('world.json', json);
}
const touched = () => { dirty = true; rosterCache = null; };

/** Catch the world up with the clock: close finished days, then let the bots drip in today's moves. */
let clockOffset = 0; // dev only: POST /api/dev/tick jumps the realm to tomorrow
function fresh() {
  const today = dayOf(Date.now() + clockOffset);
  if (W.day < today) {
    const from = W.day;
    advance(W, today, buildRaven); touched();
    for (let d = from; d < W.day; d++) sealDay(W, d, Object.keys(TITLES), hash => { W.ravens[d].tx = hash; touched(); });
    console.log('[tick] day', W.day);
  }
  const due = clockOffset ? 90 : npcDueNow();
  if (W.npcDone < due) { runNpc(W, due); touched(); }
}
setInterval(() => { try { fresh(); save(); } catch (e) { console.error(e); } }, 20_000);

// ---------------------------------------------------------------- sessions (a signed oath, no gas)
const nonces = new Map();
const sign = s => crypto.createHmac('sha256', SECRET).update(s).digest('base64url');
const makeToken = addr => { const body = `${addr.toLowerCase()}.${Date.now() + 7 * 86400_000}`; return body + '.' + sign(body); };
function who(req) {
  const t = (req.headers.authorization || '').replace(/^Bearer /, '');
  const [addr, exp, mac] = t.split('.');
  if (!addr || !mac || sign(`${addr}.${exp}`) !== mac || +exp < Date.now()) return null;
  return addr;
}

/** Every noble this wallet controls right now. Genesis ownership is read from Monad; the save file follows the token. */
async function nobleKeysOf(addr) {
  const owners = ownersMap();
  const keys = [];
  for (const [id, o] of Object.entries(owners)) if (o === addr) keys.push('g:' + id);
  for (const n of Object.values(W.nobles)) if (n.kind !== 'genesis' && n.owner === addr) keys.push(n.key);
  for (const k of keys) {
    const n = W.nobles[k];
    if (!n) continue;
    if (n.owner !== addr) { // a new lord: claimed for the first time, or bought on the market
      const first = !n.claimed;
      n.owner = addr; n.claimed = true; n.lords.push({ addr, day: W.day });
      W.events.push({ id: ++W.seq, day: W.day, t: Date.now(), type: first ? 'claim' : 'new_lord', a: k, b: null });
      touched();
    }
  }
  return keys;
}
async function controls(addr, key) {
  const n = W.nobles[key];
  if (!n) return false;
  if (n.kind === 'genesis') return (await ownerOf(n.id)) === addr; // live check, so a sold Chog stops obeying at once
  return n.owner === addr;
}

// ---------------------------------------------------------------- views
const flags = n => ({ king: W.throne.king === n.key, hand: W.throne.hand === n.key, rugged: isRugged(W, n), married: !!n.spouse,
  scars: n.marks.scars > 0, bandage: n.marks.bandage === W.day, shamed: W.events.some(e => e.day === W.day && e.type === 'stab_fail' && e.a === n.key),
  stabbed: W.events.some(e => e.day === W.day && /stab_win|kingslayer|oathbreak/.test(e.type) && e.b === n.key) });
const stickers = flags;
function nobleView(n, full = false) {
  const v = { key: n.key, kind: n.kind, id: n.id, name: displayName(n), house: n.house, tier: n.tier, clout: n.clout, claimed: n.claimed,
    traits: n.traits, stats: n.stats, titles: n.titles, flags: flags(n), spouse: n.spouse, liege: n.liege, adult: isAdult(W, n) };
  if (full) Object.assign(v, { gas: n.gasDay < W.day ? 3 : n.gas, marks: n.marks, heirs: n.heirs, parents: n.parents, grudges: n.grudges, streak: n.streak,
    lords: n.lords, tx: n.tx || null, rank: rankOf(W, n.key), owner: n.owner, img: n.kind === 'genesis' ? `/img/${n.id}` : `/art/${n.key}.svg`,
    vassals: Object.values(W.nobles).filter(x => x.liege === n.key).map(x => x.key),
    log: n.log.map(id => W.events.find(e => e.id === id)).filter(Boolean).slice(-25) });
  return v;
}
function roster() {
  if (!rosterCache) rosterCache = Object.values(W.nobles).map(n => [n.key, displayName(n), n.house, n.clout, n.claimed ? 1 : 0, isRugged(W, n) ? 1 : 0, n.tier[0], n.spouse ? 1 : 0, isAdult(W, n) ? 1 : 0]);
  return rosterCache;
}
const names = keys => Object.fromEntries([...new Set(keys.filter(Boolean))].map(k => [k, W.nobles[k] ? displayName(W.nobles[k]) : k]));
const evNames = evs => names(evs.flatMap(e => [e.a, e.b, e.heir]));

// ---------------------------------------------------------------- app
const app = express();
app.use(express.json({ limit: '32kb' }));
app.use('/api', (req, res, next) => { try { fresh(); } catch (e) { console.error(e); } next(); });

app.get('/api/health', (req, res) => res.json({ ok: true, day: W.day }));
app.get('/api/chain', (req, res) => res.json(chainInfo()));
if (process.env.CHAIN_MODE !== 'mainnet' && process.env.DEV_TICK !== 'off') app.post('/api/dev/tick', (req, res) => {
  clockOffset = (W.day + 1 - dayOf()) * 86400_000; fresh(); save();
  res.json({ day: W.day, raven: W.ravens[W.day - 1]?.lead?.headline });
});

app.get('/api/world', (req, res) => {
  const since = +req.query.since || 0;
  const evs = W.events.filter(e => e.id > since && e.type !== 'title').slice(-60);
  res.json({ day: W.day, nextTick: Date.UTC(2026, 9, 18) + W.day * 86400_000 - clockOffset, throne: W.throne, seq: W.seq,
    events: evs, names: { ...evNames(evs), ...names([W.throne.king, W.throne.hand]) },
    feasts: W.feasts.filter(f => f.until > Date.now() && !f.boom).map(f => ({ ...f, hostName: displayName(W.nobles[f.host]) })),
    ravenDays: Object.keys(W.ravens).map(Number).sort((a, b) => b - a), houses: HOUSES, titles: TITLES });
});
app.get('/api/roster', (req, res) => res.json(roster()));
app.get('/api/noble/:key', (req, res) => {
  const n = W.nobles[req.params.key];
  if (!n) return res.status(404).json({ error: 'No such noble.' });
  const v = nobleView(n, true);
  res.json({ noble: v, names: { ...evNames(v.log), ...names([n.spouse, n.liege, ...n.heirs, ...(n.parents || []), ...v.vassals, ...Object.keys(n.grudges)]) } });
});
app.get('/api/raven/:day', (req, res) => {
  const r = W.ravens[+req.params.day];
  if (!r) return res.status(404).json({ error: 'The raven has not flown yet.' });
  res.json({ ...r, names: names([r.king, r.hand, ...[r.lead, ...r.stories].filter(Boolean).flatMap(s => [s.a, s.b])]) });
});

app.post('/api/auth/nonce', (req, res) => {
  const nonce = crypto.randomBytes(12).toString('hex');
  nonces.set(nonce, Date.now());
  for (const [k, t] of nonces) if (Date.now() - t > 600_000) nonces.delete(k);
  res.json({ nonce });
});
app.post('/api/auth/verify', async (req, res) => {
  const { address, signature, nonce } = req.body || {};
  if (!nonces.has(nonce)) return res.status(400).json({ error: 'Stale oath. Try again.' });
  nonces.delete(nonce);
  if (!(await verifyLogin(address, loginMessage(address, nonce), signature))) return res.status(401).json({ error: 'That signature lies.' });
  res.json({ token: makeToken(address) });
});

app.get('/api/me', async (req, res) => {
  const addr = who(req);
  if (!addr) return res.status(401).json({ error: 'Swear the oath first.' });
  await refreshOwners();
  const keys = await nobleKeysOf(addr);
  for (const k of keys) touch(W, W.nobles[k]);
  touched();
  const pending = W.proposals.filter(p => keys.includes(p.to));
  res.json({ address: addr, nobles: keys.map(k => nobleView(W.nobles[k], true)), proposals: pending, names: names(pending.map(p => p.from)) });
});

const BASTARD_FIRST = ['Jon', 'Ramsay', 'Gendry', 'Edric', 'Ellaria', 'Mya', 'Rhaenyra', 'Walda', 'Bronn', 'Pod', 'Shae', 'Osha', 'Hot Pie', 'Davos', 'Tormund', 'Missandei', 'Grey Worm', 'Olly', 'Ygritte', 'Ser Pounce'];
app.post('/api/bastard', (req, res) => {
  const addr = who(req);
  if (!addr) return res.status(401).json({ error: 'Swear the oath first.' });
  if (Object.values(W.nobles).some(n => n.kind === 'bastard' && n.owner === addr)) return res.status(400).json({ error: 'One bastard per wallet. Even Ned had limits.' });
  const rng = new RNG('bastard:' + addr + ':' + W.seq);
  const pool = Object.values(GENESIS);
  const t = {};
  for (const k of ['Background', 'Base', 'Skin', 'Side', 'Body', 'Mouth', 'Eyes', 'Head', 'Accessory', 'Form', 'Naked']) { const v = rng.pick(pool).t[k]; if (v) t[k] = v; }
  t.Tier = 'Common';
  const id = ++W.counters.bastard;
  const n = makeNoble('bastard', id, t, { house: rng.pick(HOUSES).id, name: `${rng.pick(BASTARD_FIRST)} Snow` });
  n.owner = addr; n.claimed = true; n.lords.push({ addr, day: W.day }); n.born = W.day;
  W.nobles[n.key] = n;
  touch(W, n);
  W.events.push({ id: ++W.seq, day: W.day, t: Date.now(), type: 'bastard', a: n.key, b: null });
  mintNoble(n, null, hash => { n.tx = hash; touched(); });
  touched(); save();
  res.json({ noble: nobleView(n, true) });
});

app.post('/api/faucet', async (req, res) => {
  const addr = who(req);
  if (!addr) return res.status(401).json({ error: 'Swear the oath first.' });
  W.faucet ||= {};
  if (W.faucet[addr]) return res.status(400).json({ error: 'One test Chog per wallet. Greed is how Houses fall.' });
  await refreshOwners();
  const taken = ownersMap(), free = Object.keys(GENESIS).map(Number).filter(id => !taken[id]);
  if (!free.length) return res.status(400).json({ error: 'Every test Chog has a lord already.' });
  // prefer a Chog that is doing something interesting: some clout, not rugged
  const ranked = free.map(id => W.nobles['g:' + id]).filter(n => n && !n.claimed).sort((a, b) => b.clout - a.clout);
  const n = ranked[Math.floor(Math.random() * Math.min(60, ranked.length))] || W.nobles['g:' + free[0]];
  try {
    const tx = await faucetMint(addr, n.id);
    W.faucet[addr] = n.id; touched(); save();
    res.json({ id: n.id, key: n.key, name: displayName(n), tx });
  } catch (e) { res.status(500).json({ error: e.shortMessage || e.message }); }
});

async function actor(req, res) {
  const addr = who(req);
  if (!addr) { res.status(401).json({ error: 'Swear the oath first.' }); return null; }
  const n = W.nobles[req.body?.noble];
  if (!n || !(await controls(addr, n.key))) { res.status(403).json({ error: 'That Chog does not answer to you.' }); return null; }
  touch(W, n);
  return n;
}
const rngFor = (n, move) => new RNG(`move:${W.seq}:${n.key}:${move}:${Date.now()}`);

app.post('/api/move', async (req, res) => {
  const a = await actor(req, res); if (!a) return;
  const { move, target } = req.body;
  const b = target ? W.nobles[target] : null;
  const err = checkMove(W, a, move, b);
  if (err) return res.status(400).json({ error: err });
  const r = play(W, a, move, b, rngFor(a, move));
  if (r.heir?.owner) mintNoble(r.heir, [nobleKey(a), nobleKey(W.nobles[a.spouse])], hash => { r.heir.tx = hash; touched(); });
  touched(); save();
  const evs = [r.ev, r.boom].filter(Boolean);
  res.json({ ...r, feast: undefined, heir: r.heir ? nobleView(r.heir, true) : null, me: nobleView(a, true), target: b ? nobleView(b) : null, names: evNames(evs) });
});
app.post('/api/rsvp', async (req, res) => {
  const g = await actor(req, res); if (!g) return;
  const f = W.feasts.find(x => x.id === req.body.feast);
  if (!f) return res.status(404).json({ error: 'The feast is over. Someone ate everything.' });
  const r = rsvp(W, g, f, rngFor(g, 'rsvp'));
  if (r.error) return res.status(400).json(r);
  touched(); save();
  res.json({ ...r, me: nobleView(g, true), names: r.ev ? evNames([r.ev]) : {} });
});
app.post('/api/answer', async (req, res) => {
  const b = await actor(req, res); if (!b) return;
  const r = answerProposal(W, b, req.body.from, !!req.body.yes);
  if (r.error) return res.status(400).json(r);
  touched(); save();
  res.json({ ...r, me: nobleView(b, true), names: evNames([r.ev]) });
});

// ---------------------------------------------------------------- NFT-facing: dynamic metadata, art, image proxy
app.get('/art/:key.svg', (req, res) => {
  const n = W.nobles[req.params.key];
  if (!n) return res.status(404).end();
  res.type('image/svg+xml').set('Cache-Control', 'public, max-age=300').send(chogSVG(n.traits, stickers(n)));
});
app.get('/meta/:kind/:id', (req, res) => { // tokenURI target for Bastards and Choglings: titles live on the token
  const n = W.nobles[`${req.params.kind[0]}:${req.params.id}`];
  if (!n) return res.status(404).json({ error: 'unknown token' });
  const base = `${req.protocol}://${req.get('host')}`;
  res.json({ name: displayName(n), description: `A noble of House ${houseById(n.house).name} in the Game of Chogs. "${houseById(n.house).words}."`,
    image: `${base}/art/${n.key}.svg`, external_url: `${base}/#/noble/${n.key}`,
    attributes: [{ trait_type: 'House', value: houseById(n.house).name }, { trait_type: 'Clout', value: n.clout, display_type: 'number' },
      ...n.titles.map(t => ({ trait_type: 'Title', value: TITLES[t]?.name || t })), ...Object.entries(n.traits).map(([k, v]) => ({ trait_type: k, value: v }))] });
});
const IMG = path.join(DATA, 'img');
app.get('/img/:id', async (req, res) => { // real Genesis art: OpenSea's resized CDN copy first, then IPFS; cached on disk
  const id = +req.params.id, g = GENESIS[id];
  if (!g) return res.status(404).end();
  const file = path.join(IMG, id + '.webp');
  if (!fs.existsSync(file)) {
    try {
      let src = 'https://gateway.pinata.cloud/ipfs/' + g.img;
      if (process.env.OPENSEA_API_KEY) {
        const j = await fetch(`https://api.opensea.io/api/v2/chain/monad/contract/${GENESIS_ADDR}/nfts/${id}`, { headers: { 'x-api-key': process.env.OPENSEA_API_KEY }, signal: AbortSignal.timeout(8000) }).then(r => r.json()).catch(() => null);
        if (j?.nft?.image_url) src = j.nft.image_url + '?w=400';
      }
      const r = await fetch(src, { signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error(r.status);
      fs.mkdirSync(IMG, { recursive: true });
      fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
    } catch { return res.redirect(`/art/g:${id}.svg`); }
  }
  res.type('image/webp').set('Cache-Control', 'public, max-age=604800').sendFile(file);
});

const dist = path.resolve('dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api|meta|art|img).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const PORT = +process.env.PORT || 8787;
app.listen(PORT, () => console.log(`[game-of-chogs] http://localhost:${PORT}  day ${W.day}`));
refreshOwners().catch(e => console.warn('[chain] owners', e.message));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { dirty = true; save(); await flushAll(); process.exit(0); });
