import test from 'node:test';
import assert from 'node:assert';
import { RNG } from '../shared/rng.js';
import { newWorld, advance, runNpc, play, checkMove, touch, makeNoble, displayName } from '../shared/game.js';
import { buildRaven } from '../shared/raven.js';

const fake = () => {
  const r = new RNG('fake'), g = {};
  const pick = a => a[Math.floor(r.next() * a.length)];
  for (let i = 1; i <= 300; i++) g[i] = { t: { Background: pick(['Deep Aqua', 'Pink', 'Lime', 'Sky', 'Sand']), Base: 'Origin', Skin: pick(['Pink', 'Blue', 'Red']),
    Body: pick(['Yellow 143 Jersey', 'Suit', 'Hoodie']), Mouth: pick(['Flat', 'Grin']), Eyes: pick(['BTC Glass', 'Laser', 'Normal']), Head: pick(['MCGA', 'CHOG Cap', 'Bucket']),
    Accessory: pick(['Fwog', 'None']), Tier: pick(['Common', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary']), Naked: 'No' } };
  return g;
};

test('a week of bots produces a kingdom, a king and a Raven every day', () => {
  const w = newWorld(fake(), 1);
  const me = makeNoble('bastard', 1, w.nobles['g:1'].traits); me.claimed = true; w.nobles[me.key] = me;
  for (let d = 1; d <= 7; d++) {
    touch(w, me);
    const rng = new RNG('me' + d);
    for (let i = 0; i < 3; i++) { const b = w.nobles['g:' + (i + 2)]; if (!checkMove(w, me, 'stab', b)) play(w, me, 'stab', b, rng); }
    runNpc(w, 90);
    advance(w, d + 1, buildRaven);
  }
  assert.ok(w.throne.king);
  assert.equal(Object.keys(w.ravens).length, 7);
  for (const r of Object.values(w.ravens)) assert.ok(r.lead?.headline && !/\{\w+\}/.test(r.lead.headline + r.lead.body), 'filled');
  for (const n of Object.values(w.nobles)) assert.ok(n.clout >= 0);
  const counts = {}; for (const e of w.events) counts[e.type] = (counts[e.type] || 0) + 1;
  console.log(counts, 'heirs', w.counters.heir, 'king', displayName(w.nobles[w.throne.king]), w.nobles[w.throne.king].clout);
  console.log(w.ravens[7].lead.headline, '|', w.ravens[7].lead.body);
  console.log('me', me.gas, me.clout, me.titles, me.marks);
});
