// Place names for the Seven Chogdoms: famous Westeros parodies first, then generated mash-ups.
export const FAMOUS = [
  "Chog's Landing", 'Winterfart', 'Casterly Rug', 'Highgas', 'Gas\'s End', 'Sunfart', 'Harrenhodl', 'Wagonstone',
  'The Pump', 'Riverrug', 'The Eyrie of Wen', 'Bravoss', 'Dumpstone', 'Oldtown Mint', 'The Twin Wallets',
  'Bagholder\'s Rest', 'The Rugged Isles', 'Moat Gasin', 'Hodlgarden', 'Dorne-to-Rug', 'Qarth-a-Fart',
  'The Fingers of Paper', 'Bear Market Island', 'Meereen of Memes', 'Valyria (Rekt)', 'Frogsmouth',
];
const PRE = ['Gas', 'Fart', 'Rug', 'Pump', 'Dump', 'Hodl', 'Mint', 'Moon', 'Wen', 'Fwog', 'Chog', 'Ape', 'Degen', 'Wagmi', 'Shill', 'Bonk', 'Burp', 'Toot'];
const SUF = ['shire', 'fell', 'water', 'stone', 'hold', 'keep', 'mouth', 'ford', 'bury', 'march', 'hollow', 'spire', 'crag', 'wick', 'mere', 'gate'];

let famousLeft = null;
export function placeName(rng) {
  if (!famousLeft) famousLeft = rng.shuffle([...FAMOUS]);
  if (famousLeft.length) return famousLeft.pop();
  return rng.pick(PRE) + rng.pick(SUF);
}
export function resetNames() { famousLeft = null; }
