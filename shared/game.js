// Game of Chogs rules. Pure and deterministic: the server owns the world and calls these, the client only
// reads them (for odds previews and labels). Every noble is keyed by its NFT: g:<id> Genesis, b:<id> Bastard,
// h:<id> Chogling heir. State follows the token, never the wallet.
import { RNG, hashStr, clamp } from './rng.js';

export const DAY_MS = 86_400_000;
export const EPOCH = Date.UTC(2026, 9, 18); // Day 1 = 18 Oct 2026, the night the Raven first flew
export const dayOf = (t = Date.now()) => Math.floor((t - EPOCH) / DAY_MS) + 1;
export const GAS_PER_DAY = 3;
export const NPC_MOVES_PER_DAY = 90;
export const GRUDGE_DAYS = 3;
export const FEAST_HOURS = 6;

export const HOUSES = [
  { id: 'snark', name: 'Snark', words: 'Winter Is Chogging', color: '#9fb4c7', ink: '#1d2b38', sigil: 'frog' },
  { id: 'lambopiss', name: 'Lambopiss', words: 'A Chog Always Pays Its Gas Fees', color: '#e8423f', ink: '#5a0f0e', sigil: 'lion' },
  { id: 'targaryeet', name: 'Targaryeet', words: 'Fire and Farts', color: '#2b2233', ink: '#e8423f', sigil: 'dragon' },
  { id: 'greyjoint', name: 'Greyjoint', words: 'We Do Not Sell', color: '#f4c430', ink: '#26221a', sigil: 'squid' },
  { id: 'tyrelly', name: 'Tyrelly', words: 'Growing Bags', color: '#5fbf4a', ink: '#173d12', sigil: 'rose' },
  { id: 'bagatheon', name: 'Bagatheon', words: 'Ours Is the Dump', color: '#ff9f1c', ink: '#3b2200', sigil: 'stag' },
  { id: 'martelly', name: 'Martelly', words: 'Unbowed, Unbrushed, Unrugged', color: '#b06cff', ink: '#2c0f4f', sigil: 'sun' },
];
export const houseById = id => HOUSES.find(h => h.id === id) || HOUSES[0];

// Rarity is a different opening game, not just bigger numbers: it sets stat floors and starting clout.
export const TIER_BONUS = { Common: 0, Uncommon: 1, Rare: 2, Epic: 3, Legendary: 4, Mythic: 5, '1/1': 5 };

export const TITLES = {
  kingslayer: { name: 'Kingslayer', desc: 'Stabbed the Chog on the Iron Toilet.' },
  kinglet: { name: 'Sat the Iron Toilet', desc: 'Held the throne for a day.' },
  hand: { name: 'Hand of the Chog', desc: 'Second in the realm at a coronation.' },
  oathbreaker: { name: 'Oathbreaker', desc: 'Stabbed their own liege.' },
  shamed: { name: 'The Shamed', desc: 'Three walks of shame. Ding ding ding.' },
  unstabbable: { name: 'The Unstabbable', desc: 'Survived five stabbings.' },
  redwedding: { name: 'Red Wedding Planner', desc: 'Hosted a feast that exploded.' },
  fartfather: { name: 'Fartfather', desc: 'Begot three heirs.' },
  twicewed: { name: 'Twice-Wed', desc: 'Married twice. Romantic. Suspicious.' },
  duelist: { name: 'Sword of the Mornin\'', desc: 'Won five duels.' },
  generous: { name: 'The Generous', desc: 'Threw five feasts.' },
  nightswatch: { name: 'Night\'s Watch', desc: 'Came back five days in a row.' },
  legitimised: { name: 'Legitimised', desc: 'A bastard who reached 100 clout.' },
  shank: { name: 'Master of Whispers', desc: 'Ten successful stabs.' },
};

export const MOVES = {
  stab: { gas: 1, target: true, label: 'STAB', blurb: 'Steal their clout. Fail and do the walk of shame.' },
  duel: { gas: 1, target: true, label: 'DUEL', blurb: 'Trial by combat. Winner keeps a scar, loser a bandage.' },
  feast: { gas: 1, target: false, label: 'FEAST', blurb: 'Throw a party. Guests bring clout. Enemies bring knives.' },
  propose: { gas: 1, target: true, label: 'PROPOSE', blurb: 'Marry them. Married Chogs can beget heirs.' },
  beget: { gas: 2, target: false, label: 'BEGET HEIR', blurb: 'Mint a Chogling NFT from you and your spouse.' },
  knee: { gas: 1, target: true, label: 'BEND THE KNEE', blurb: 'Swear to a liege. They grow, you get protection.' },
};

const HEIR_NAMES = ['Joffrog', 'Sansog', 'Aryap', 'Tyrchog', 'Jon Snog', 'Cersog', 'Brandog', 'Hodlr', 'Daenerug', 'Theonk', 'Robbag', 'Rickonk',
  'Tommog', 'Myrcellog', 'Gendrog', 'Podrick Pumpe', 'Brienne of Tarp', 'Samwell Tardy', 'Varyss', 'Littlechog', 'Melisandump', 'Bronnk', 'Ygrug', 'Ramsog'];

// ---------------------------------------------------------------- nobles
const statRoll = (a, b, salt) => 2 + (hashStr(salt + ':' + a) % 4) + (hashStr(salt + ':' + b) % 4); // 2..8

export function deriveStats(t) {
  const tb = TIER_BONUS[t.Tier] || 0;
  return {
    cunning: statRoll(t.Eyes, t.Accessory, 'cun') + tb,
    might: statRoll(t.Body, t.Base, 'mig') + tb,
    charm: statRoll(t.Head, t.Mouth, 'cha') + tb + (t.Naked === 'Yes' ? 2 : 0),
  };
}
export const houseFor = t => HOUSES[hashStr('house:' + (t.Background || '')) % HOUSES.length].id;
/** Backgrounds are packed into the seven Houses so each gets roughly the same number of Chogs. */
export function houseTable(genesis) {
  const count = {};
  for (const g of Object.values(genesis)) count[g.t.Background] = (count[g.t.Background] || 0) + 1;
  const load = HOUSES.map(() => 0), table = {};
  for (const [bg, c] of Object.entries(count).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    const h = load.indexOf(Math.min(...load));
    table[bg] = HOUSES[h].id; load[h] += c;
  }
  return table;
}

export function makeNoble(kind, id, traits, extra = {}) {
  const tb = TIER_BONUS[traits.Tier] || 0;
  return {
    key: kind[0] + ':' + id, kind, id, traits, tier: traits.Tier || 'Common',
    house: extra.house || houseFor(traits), name: extra.name || null,
    stats: deriveStats(traits), clout: 10 + tb * 3,
    gas: GAS_PER_DAY, gasDay: 0, owner: null, claimed: false, lords: [],
    titles: [], marks: { scars: 0, bandage: 0, shame: 0, stabbed: 0, survived: 0, stabWins: 0, duelWins: 0, feasts: 0, marriages: 0 },
    spouse: null, liege: null, parents: extra.parents || null, heirs: [], rugged: 0, lastBeget: 0,
    grudges: {}, streak: 0, lastSeen: 0, born: extra.born || 0, log: [],
  };
}

/** Holders know their Chog by the number in its metadata ("CHOG #1462" is token 1), so that is its name here too. */
export const genesisNoble = (id, g, table) => makeNoble('genesis', +id, g.t, { house: table?.[g.t.Background], name: `Chog #${(g.img || '').match(/(\d+)\.\w+$/)?.[1] || id}` });
export const displayName = n => n.name || (n.kind === 'genesis' ? `Chog #${n.id}` : n.kind === 'bastard' ? `Chog Snow #${n.id}` : `Chogling #${n.id}`);
export const isAdult = (w, n) => n.kind !== 'heir' || w.day - n.born >= 2;
export const isRugged = (w, n) => n.rugged === w.day;
const top = (w, k) => Object.values(w.nobles).sort((a, b) => b.clout - a.clout).slice(0, k).map(n => n.key);

export function newWorld(genesis, day = dayOf()) {
  const w = { v: 1, day, npcDone: 0, seq: 0, nobles: {}, events: [], ravens: {}, throne: { king: null, hand: null, since: 0 },
    proposals: [], feasts: [], counters: { bastard: 0, heir: 0 }, owners: {} };
  w.houseTable = houseTable(genesis);
  for (const [id, g] of Object.entries(genesis)) w.nobles['g:' + id] = genesisNoble(id, g, w.houseTable);
  crown(w, day - 1, new RNG('crown0'));
  return w;
}

// ---------------------------------------------------------------- events
function emit(w, type, a, b, extra = {}) {
  const ev = { id: ++w.seq, day: w.day, t: Date.now(), type, a: a?.key || null, b: b?.key || null, ...extra };
  w.events.push(ev);
  if (w.events.length > 4000) w.events.splice(0, w.events.length - 4000);
  for (const n of [a, b]) if (n) { n.log.push(ev.id); if (n.log.length > 40) n.log.shift(); }
  return ev;
}
function grantTitle(w, n, id, out) {
  if (n.titles.includes(id)) return;
  n.titles.push(id);
  out.push(id);
  emit(w, 'title', n, null, { title: id });
}
function rug(w, n, by) {
  if (isRugged(w, n)) return;
  n.rugged = w.day;
  emit(w, 'rugged', n, by);
}

/** Why a move is not allowed, or null. `npc` skips gas (bots act for free). */
export function checkMove(w, a, move, b, npc = false) {
  const M = MOVES[move];
  if (!M) return 'Unknown move.';
  if (!a) return 'No such noble.';
  if (isRugged(w, a)) return 'You have been rugged. What is rugged may never die: rise again tomorrow.';
  if (!isAdult(w, a)) return 'Choglings must grow up first (2 days).';
  if (!npc && a.gas < M.gas) return 'Out of gas. Come back tomorrow, or burn some $CHOG.';
  if (M.target) {
    if (!b) return 'Pick a target.';
    if (b.key === a.key) return 'You cannot do that to yourself. Well, you could, but not here.';
    if (isRugged(w, b) && move !== 'knee') return `${displayName(b)} is already rugged. Have some decency.`;
  }
  if (move === 'propose') {
    if (a.spouse) return 'You are already married. This is not that kind of kingdom.';
    if (b.spouse) return `${displayName(b)} is already married.`;
    if (w.proposals.some(p => p.from === a.key && p.to === b.key)) return 'You already proposed. Be patient, or be creepy elsewhere.';
  }
  if (move === 'beget') {
    if (!a.spouse) return 'Get married first.';
    if (a.lastBeget && w.day - a.lastBeget < 2) return 'The stork needs 2 days to recover.';
    if (a.heirs.length >= 6) return 'Six heirs is enough heirs.';
  }
  if (move === 'knee') {
    if (a.liege === b.key) return `You already serve ${displayName(b)}.`;
    for (let c = b, i = 0; c && i < 50; c = w.nobles[c.liege], i++) if (c.liege === a.key) return `${displayName(b)} already serves you (or your vassals).`;
  }
  if (move === 'feast' && w.feasts.some(f => f.host === a.key && f.until > Date.now())) return 'Your last feast is still going.';
  return null;
}

/** Odds of success for a contested move, for the UI preview and the roll. */
export function odds(w, a, move, b) {
  const s = a.stats, t = b.stats;
  let p = 0.5;
  if (move === 'stab') {
    p += (s.cunning - (t.cunning + t.might) / 2) * 0.05;
    if (a.grudges[b.key] >= w.day) p += 0.15;                            // the Chain remembers
    if (w.throne.king === b.key) p -= 0.1;                                // the Kingsguard
    const t10 = top(w, 10);
    if (t10.includes(b.key) && !t10.includes(a.key)) p += 0.1;            // chaos is a ladder
  } else if (move === 'duel') {
    p += ((s.might + s.charm * 0.3) - (t.might + t.charm * 0.3)) * 0.05;
  } else if (move === 'propose') {
    p = 0.35 + (s.charm - t.charm) * 0.05 + (b.grudges[a.key] >= w.day ? -0.3 : 0);
  } else return 1;
  return clamp(p, 0.12, 0.88);
}

/** Play a move. Mutates the world, returns { ev, ok, toast, titles, heir }. Assumes checkMove passed. */
export function play(w, a, move, b, rng, npc = false) {
  if (!npc) a.gas -= MOVES[move].gas;
  const titles = [];
  const res = { ok: true, titles };
  const p = b ? odds(w, a, move, b) : 1;
  const win = rng.next() < p;

  if (move === 'stab') {
    if (win) {
      const steal = Math.max(3, Math.round(b.clout * 0.15));
      b.clout = Math.max(0, b.clout - steal); a.clout += steal;
      b.marks.stabbed++; a.marks.stabWins++;
      b.grudges[a.key] = w.day + GRUDGE_DAYS;
      const regicide = w.throne.king === b.key, treason = a.liege === b.key, divorce = a.spouse === b.key;
      res.ev = emit(w, regicide ? 'kingslayer' : treason ? 'oathbreak' : 'stab_win', a, b, { n: steal });
      if (regicide) grantTitle(w, a, 'kingslayer', titles);
      if (treason) { grantTitle(w, a, 'oathbreaker', titles); a.liege = null; }
      if (divorce) { a.spouse = null; b.spouse = null; }
      if (b.liege && w.nobles[b.liege]) w.nobles[b.liege].grudges[a.key] = w.day + GRUDGE_DAYS; // the liege remembers too
      if (a.marks.stabWins >= 10) grantTitle(w, a, 'shank', titles);
      if (b.clout === 0 || w.events.filter(e => e.day === w.day && e.b === b.key && /stab_win|kingslayer|oathbreak/.test(e.type)).length >= 3) rug(w, b, a);
    } else {
      res.ok = false;
      a.clout = Math.max(0, a.clout - 5);
      a.marks.shame++; b.marks.survived++;
      b.grudges[a.key] = w.day + GRUDGE_DAYS;
      res.ev = emit(w, 'stab_fail', a, b);
      if (a.marks.shame >= 3) grantTitle(w, a, 'shamed', titles);
      if (b.marks.survived >= 5) grantTitle(w, b, 'unstabbable', titles);
    }
  } else if (move === 'duel') {
    const [W, L] = win ? [a, b] : [b, a];
    W.clout += 8; L.clout = Math.max(0, L.clout - 5);
    W.marks.scars++; W.marks.duelWins++; L.marks.bandage = w.day;
    res.ok = win;
    res.ev = emit(w, 'duel_win', W, L, { challenger: a.key });
    if (W.marks.duelWins >= 5) grantTitle(w, W, 'duelist', titles);
    if (L.clout === 0) rug(w, L, W);
  } else if (move === 'feast') {
    a.clout += 3; a.marks.feasts++;
    const feast = { id: w.seq + 1, host: a.key, day: w.day, until: Date.now() + FEAST_HOURS * 3600_000, guests: [], boom: false };
    w.feasts.push(feast);
    res.ev = emit(w, 'feast', a, null, { feast: feast.id, n: 0 });
    if (a.marks.feasts >= 5) grantTitle(w, a, 'generous', titles);
    // a few unclaimed nobles always turn up for free food (and sometimes for revenge)
    const pool = Object.values(w.nobles).filter(n => !n.claimed && n.key !== a.key && !isRugged(w, n));
    for (let i = rng.int(2, 4); i > 0 && !feast.boom; i--) {
      const r = rsvp(w, rng.pick(pool), feast, rng);
      if (r.boom) res.boom = r.ev;
    }
    res.feast = feast;
  } else if (move === 'propose') {
    if (b.claimed) { // a real holder must consent, even to a bot
      if (w.proposals.some(p => p.from === a.key && p.to === b.key)) return { ok: false, titles, ev: null };
      w.proposals.push({ from: a.key, to: b.key, day: w.day });
      res.ev = emit(w, 'propose', a, b);
      res.pending = true;
    }
    else if (win) {
      res.ev = marry(w, a, b, titles);
    } else {
      res.ok = false;
      res.ev = emit(w, 'propose_reject', a, b);
    }
  } else if (move === 'beget') {
    const sp = w.nobles[a.spouse];
    const id = ++w.counters.heir;
    const t = {};
    for (const k of new Set([...Object.keys(a.traits), ...Object.keys(sp.traits)])) t[k] = rng.chance(0.5) ? a.traits[k] ?? sp.traits[k] : sp.traits[k] ?? a.traits[k];
    if (rng.chance(0.15)) { const donor = w.nobles['g:' + rng.int(1, 1969)]; if (donor) { const k = rng.pick(['Head', 'Eyes', 'Mouth', 'Body', 'Accessory']); t[k] = donor.traits[k]; } }
    t.Tier = rng.chance(0.5) ? a.traits.Tier : sp.traits.Tier;
    const heir = makeNoble('heir', id, t, { house: a.house, parents: [a.key, sp.key], born: w.day, name: `${rng.pick(HEIR_NAMES)} ${houseById(a.house).name}` });
    heir.owner = a.owner; heir.claimed = !!a.claimed; heir.clout = 5;
    w.nobles[heir.key] = heir;
    a.heirs.push(heir.key); sp.heirs.push(heir.key); a.lastBeget = w.day; a.clout += 4;
    res.ev = emit(w, 'beget', a, sp, { heir: heir.key });
    res.heir = heir;
    if (a.heirs.length >= 3) grantTitle(w, a, 'fartfather', titles);
  } else if (move === 'knee') {
    a.liege = b.key; b.clout += 3 + (w.throne.king === b.key ? 1 : 0);
    res.ev = emit(w, 'knee', a, b);
  }
  if (a.kind === 'bastard' && a.clout >= 100) grantTitle(w, a, 'legitimised', titles);
  return res;
}

function marry(w, a, b, titles) {
  a.spouse = b.key; b.spouse = a.key;
  for (const n of [a, b]) { n.marks.marriages++; if (n.marks.marriages >= 2) grantTitle(w, n, 'twicewed', titles); }
  w.proposals = w.proposals.filter(p => ![p.from, p.to].some(k => k === a.key || k === b.key));
  return emit(w, 'marry', a, b);
}

/** A claimed noble answers a proposal (free, no gas: consent should not cost gas). */
export function answerProposal(w, b, fromKey, yes) {
  const i = w.proposals.findIndex(p => p.to === b.key && p.from === fromKey);
  if (i < 0) return { error: 'That proposal has expired.' };
  const a = w.nobles[fromKey];
  w.proposals.splice(i, 1);
  if (!yes) return { ev: emit(w, 'propose_reject', a, b) };
  if (a.spouse || b.spouse) return { error: 'Someone got married in the meantime. Awkward.' };
  const titles = [];
  return { ev: marry(w, a, b, titles), titles };
}

/** Attend a feast. 20% chance of a Red Wedding if anyone at the table holds a grudge against the newcomer. */
export function rsvp(w, g, feast, rng) {
  if (!g || feast.boom || feast.guests.includes(g.key) || feast.host === g.key || feast.until < Date.now()) return { error: 'You cannot attend that feast.' };
  const host = w.nobles[feast.host];
  feast.guests.push(g.key);
  g.clout += 1; host.clout += 2;
  const table = [feast.host, ...feast.guests].map(k => w.nobles[k]);
  const feud = table.some(n => n.key !== g.key && (n.grudges[g.key] >= w.day || g.grudges[n.key] >= w.day));
  if (feud && rng.chance(0.2)) {
    feast.boom = true;
    for (const n of table) n.clout = Math.max(0, n.clout - 5);
    const titles = [];
    grantTitle(w, host, 'redwedding', titles);
    return { boom: true, ev: emit(w, 'red_wedding', host, g, { n: table.length }) };
  }
  const ev = w.events.find(e => e.type === 'feast' && e.feast === feast.id);
  if (ev) ev.n = feast.guests.length;
  return { ok: true };
}

// ---------------------------------------------------------------- daily tick
/** Refill gas and keep the Night's Watch streak when a player shows up. */
export function touch(w, n) {
  if (n.gasDay < w.day) { n.gas = GAS_PER_DAY; n.gasDay = w.day; }
  if (n.lastSeen < w.day) {
    n.streak = n.lastSeen === w.day - 1 ? n.streak + 1 : 1;
    n.lastSeen = w.day;
    if (n.streak >= 2) emit(w, 'streak', n, null, { n: n.streak });
    if (n.streak >= 5) grantTitle(w, n, 'nightswatch', []);
  }
}

function crown(w, day, rng) {
  const ranked = Object.values(w.nobles).filter(n => isAdult(w, n)).sort((a, b) => b.clout - a.clout || a.key.localeCompare(b.key));
  const [k, h] = ranked;
  if (!k) return;
  if (w.throne.king !== k.key) {
    w.throne = { king: k.key, hand: h?.key || null, since: day + 1 };
    if (w.seq) { emit(w, 'crown', k, null); grantTitle(w, k, 'kinglet', []); }
  } else w.throne.hand = h?.key || null;
  if (h && w.seq) grantTitle(w, h, 'hand', []);
}

/** Advance to `toDay`: close each finished day (vassal tithes, coronation, Raven), then open the next. */
export function advance(w, toDay, buildRaven) {
  while (w.day < toDay) {
    const d = w.day, rng = new RNG('tick:' + d);
    runNpc(w, NPC_MOVES_PER_DAY); // whatever the bots had not got round to yet
    for (const n of Object.values(w.nobles)) if (n.liege && w.nobles[n.liege]) w.nobles[n.liege].clout += 1;
    crown(w, d, rng);
    if (buildRaven) w.ravens[d] = buildRaven(w, d);
    w.day = d + 1; w.npcDone = 0;
    w.proposals = w.proposals.filter(p => w.day - p.day <= 2);
    w.feasts = w.feasts.filter(f => f.until > Date.now() - DAY_MS);
    for (const n of Object.values(w.nobles)) for (const k in n.grudges) if (n.grudges[k] < w.day) delete n.grudges[k];
  }
}

/** Unclaimed nobles scheme on their own, spread across the day so the ticker never goes quiet. */
export function runNpc(w, target) {
  const rng = new RNG('npc:' + w.day + ':' + w.npcDone);
  const all = Object.values(w.nobles).filter(n => !n.claimed && isAdult(w, n) && !isRugged(w, n));
  const out = [];
  while (w.npcDone < target && all.length) {
    w.npcDone++;
    // the aggrieved act first: revenge is the engine of this whole kingdom
    const avengers = all.filter(n => Object.keys(n.grudges).length && !isRugged(w, n));
    const a = avengers.length && rng.chance(0.6) ? rng.pick(avengers) : rng.pick(all);
    if (isRugged(w, a)) continue;
    let move, b = null;
    const enemy = Object.keys(a.grudges).map(k => w.nobles[k]).find(n => n && !isRugged(w, n));
    if (enemy && rng.chance(0.75)) { move = rng.chance(0.75) ? 'stab' : 'duel'; b = enemy; }
    else if (a.spouse && rng.chance(0.3)) move = 'beget';
    else {
      move = rng.weighted([['stab', 45], ['duel', 20], ['feast', 8], ['propose', 12], ['knee', 10], ['beget', 5]]);
      if (MOVES[move].target) {
        const ranked = Object.values(w.nobles).filter(n => isAdult(w, n) && !isRugged(w, n) && n.key !== a.key);
        b = move === 'knee' ? rng.pick(ranked.sort((x, y) => y.clout - x.clout).slice(0, 25)) : rng.pick(ranked);
      }
    }
    if (checkMove(w, a, move, b, true)) continue;
    out.push(play(w, a, move, b, rng, true));
  }
  return out;
}

/** How many bot moves should have happened by now, so they drip in through the day. */
export const npcDueNow = (t = Date.now()) => Math.floor(((t - EPOCH) % DAY_MS) / DAY_MS * NPC_MOVES_PER_DAY);

// ---------------------------------------------------------------- views
export const rankOf = (w, key) => Object.values(w.nobles).filter(n => n.clout > w.nobles[key].clout).length + 1;
