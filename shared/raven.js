// The Raven: the daily tabloid, stitched from a day's events and the template bank. No LLM, no API.
// Each issue is frozen as text when the day closes, so the archive is a permanent history of the realm.
import { RNG, hashStr } from './rng.js';
import { FAMOUS } from './names.js';
import { RAVEN, QUOTES, RUMORS, MASTHEAD_TAGLINES } from './ravenLines.js';
import { displayName, houseById, TITLES } from './game.js';

const DRAMA = { kingslayer: 100, red_wedding: 90, crown: 85, oathbreak: 70, beget: 50, marry: 45, claim: 45, stab_fail: 35,
  rugged: 30, stab_win: 28, bastard: 22, duel_win: 22, propose_reject: 20, streak: 12, feast: 15, knee: 14 };

export function fill(tpl, w, ev) {
  const A = w.nobles[ev.a], B = w.nobles[ev.b];
  return tpl.replace(/\{(\w+)\}/g, (_, k) => ({
    a: A ? displayName(A) : 'Someone', b: B ? displayName(B) : 'someone',
    ha: A ? houseById(A.house).name : 'Nobody', hb: B ? houseById(B.house).name : 'Nobody',
    place: ev.place || 'Chog\'s Landing', heir: ev.heir && w.nobles[ev.heir] ? displayName(w.nobles[ev.heir]) : 'a Chogling',
    n: ev.n ?? 'several', title: ev.title ? TITLES[ev.title]?.name || ev.title : 'something shameful',
  })[k] ?? _);
}

export function buildRaven(w, day) {
  const rng = new RNG('raven:' + day);
  const evs = w.events.filter(e => e.day === day && RAVEN[e.type]);
  const claimed = k => k && w.nobles[k]?.claimed;
  const score = e => DRAMA[e.type] + (claimed(e.a) || claimed(e.b) ? 25 : 0) + rng.next() * 10;
  const ranked = evs.map(e => [score(e), e]).sort((a, b) => b[0] - a[0]).map(x => x[1]);
  // one story per noble pair, so a single feud does not eat the whole front page
  const seen = new Set(), picks = [];
  for (const e of ranked) {
    const k = [e.a, e.b].sort().join('|');
    if (seen.has(k)) continue;
    seen.add(k); picks.push(e);
    if (picks.length >= 6) break;
  }
  const story = e => ({ type: e.type, a: e.a, b: e.b, headline: fill(rng.pick(RAVEN[e.type].headline), w, e), body: fill(rng.pick(RAVEN[e.type].body), w, e) });
  const rumorSrc = ranked.slice(6).filter(e => e.a);
  const rumors = [];
  for (let i = 0; i < 2 && rumorSrc.length; i++) rumors.push(fill(rng.pick(RUMORS), w, rng.pick(rumorSrc)));
  const counts = {};
  for (const e of evs) counts[e.type] = (counts[e.type] || 0) + 1;
  return {
    day, tagline: rng.pick(MASTHEAD_TAGLINES), quote: rng.pick(QUOTES),
    lead: picks[0] ? story(picks[0]) : null, stories: picks.slice(1).map(story), rumors,
    king: w.throne.king, hand: w.throne.hand,
    stats: { stabs: (counts.stab_win || 0) + (counts.kingslayer || 0) + (counts.oathbreak || 0), shames: counts.stab_fail || 0, weddings: counts.marry || 0, heirs: counts.beget || 0, feasts: counts.feast || 0 },
  };
}
