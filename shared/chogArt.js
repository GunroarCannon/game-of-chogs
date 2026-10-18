// Doodle Chog generator: one SVG string from a Chog's real traits, drawn in the collection's style (round cream
// head, spiky quills, slogan cap, big grin, blush) with a wobbly marker line. Shared so the server can render
// Chogling NFT images too. `state` adds game stickers: crown, scars, bandage, shame, ring, rugged.
import { hashStr } from './rng.js';

const INK = '#141014';
const BG = { Lemon: '#fff27a', Rosie: '#f7a1c4', 'Light Purple': '#cdb4f5', Sunlight: '#ffd84d', 'Coral Pink': '#ff8f80', 'Light Magenta': '#f08bdc',
  'Sky Blue': '#8fd3ff', Mint: '#a8f0c6', Mon: '#836ef9', Aqua: '#6ee7e0', 'Peach Pink': '#ffc2a8', 'Soft Lavender': '#e0d4ff', 'Aqua Mint': '#9ff2dc',
  'Lemon Yellow': '#f9f871', 'Deep Aqua': '#2fb8b0', 'Rosy Pink': '#ff9ec0', 'Fresh Green': '#8be26a', 'Deep Blue': '#3b5bdb', 'Lime Green': '#b6f24a',
  Radioactive: '#c6ff00', 'Noble Blue': '#4361ee' };
const SKIN = { Origin: '#ff4d6d', Pink: '#ff8fc7', Black: '#2b2b2b', Red: '#e63946', Yellow: '#ffd60a', White: '#f4f4f4', Green: '#52b788', Grey: '#9e9e9e', Blue: '#4ea8de' };
const WORDS = [['gold', '#f2c230'], ['red', '#e63946'], ['black', '#262626'], ['dark', '#2d2d3a'], ['yellow', '#ffd23f'], ['banana', '#ffe14d'], ['white', '#f5f1e8'],
  ['cream', '#f3e3c3'], ['blue', '#3a86ff'], ['cyan', '#3ad6e8'], ['aqua', '#2ec4b6'], ['pink', '#ff7eb6'], ['purple', '#8e5cf7'], ['mon', '#836ef9'], ['orange', '#ff8c2b'],
  ['grey', '#9a9a9a'], ['gray', '#9a9a9a'], ['green', '#4caf50'], ['brown', '#8b5a2b'], ['army', '#5b6b3a'], ['fire', '#ff5a1f'], ['wizard', '#4b3fa8'], ['king', '#8e1b3a'],
  ['jesus', '#f5f1e8'], ['mummy', '#e9dfc9'], ['inmate', '#ff8c2b'], ['prisoner', '#f5f1e8'], ['shark', '#7d8fa3'], ['dragon', '#3fae5a'], ['duck', '#ffd23f'], ['astro', '#e8e8f0']];
const colorFor = (name, fallbackSalt) => {
  const s = (name || '').toLowerCase();
  for (const [k, c] of WORDS) if (s.includes(k)) return c;
  return `hsl(${hashStr(fallbackSalt + s) % 360} 70% 58%)`;
};
const esc = s => String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);

// slogan for the cap: "WAGMI Cap" → WAGMI, "Mon Cap" → MON, "Red Peace Cap" → ☮
function capText(head) {
  const t = head.replace(/\b(cap|beanie|hat)\b/gi, '').trim();
  if (/peace/i.test(t)) return '☮';
  if (/star/i.test(t)) return '★';
  if (/thunder/i.test(t)) return '⚡';
  if (/dollar/i.test(t)) return '$';
  if (/cloud/i.test(t)) return '☁';
  if (/^balls$/i.test(t)) return 'BALLS';
  if (/retard/i.test(t)) return 'REKT';
  return t.toUpperCase().slice(0, 9);
}

function quills(color, rng) {
  const cx = 100, cy = 96, out = [];
  const angles = [-176, -150, -124, -56, -30, -4, 164, 16];
  for (const deg of angles) {
    const a = deg * Math.PI / 180, w = 0.27, len = 1.45 + rng(0.3);
    const p = (ang, r) => `${(cx + Math.cos(ang) * 66 * r).toFixed(1)},${(cy + Math.sin(ang) * 56 * r).toFixed(1)}`;
    out.push(`<polygon points="${p(a - w, 0.86)} ${p(a, len)} ${p(a + w, 0.86)}" fill="${color}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`);
  }
  return out.join('');
}

let jersey = ''; // text that must not be mirrored with the body
function body(name, acc) {
  jersey = '';
  const s = (name || '').toLowerCase(), c = colorFor(name, 'body');
  let g = `<path d="M22 204 C 26 168, 58 150, 100 150 C 142 150, 174 168, 178 204 Z" fill="${c}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`;
  if (/tux|suit|vest|ceo|gangster/.test(s)) {
    g += `<path d="M84 151 L100 190 L116 151 Z" fill="#fff" stroke="${INK}" stroke-width="3.5"/><path d="M96 158 L100 186 L104 158 L100 153 Z" fill="${/red/.test(s) ? '#111' : '#d62828'}" stroke="${INK}" stroke-width="2.5"/>`;
    g += `<path d="M84 151 L72 166 L92 178 Z M116 151 L128 166 L108 178 Z" fill="${c}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round" opacity=".9"/>`;
  } else if (/jersey|\d/.test(s)) {
    const num = (name.match(/\d+/) || ['67'])[0].slice(0, 3);
    jersey = `<text x="100" y="196" text-anchor="middle" font-family="Impact, 'Arial Black', sans-serif" font-size="30" fill="#fff" stroke="${INK}" stroke-width="2.5" paint-order="stroke">${num}</text>`;
  } else if (/hoodie/.test(s)) {
    g += `<path d="M70 156 Q100 176 130 156" fill="none" stroke="${INK}" stroke-width="4"/><path d="M90 168 L88 192 M110 168 L112 192" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>`;
  } else if (/robe|king/.test(s)) {
    g += `<path d="M40 176 Q100 160 160 176" fill="none" stroke="#fff" stroke-width="10"/>` + [52, 72, 92, 112, 132, 150].map(x => `<circle cx="${x}" cy="${172 - Math.abs(100 - x) * -0.04}" r="2.4" fill="${INK}"/>`).join('');
  } else if (/stripe|inmate|prison/.test(s)) {
    g += [160, 172, 184, 196].map(y => `<path d="M30 ${y} Q100 ${y - 8} 170 ${y}" stroke="${INK}" stroke-width="4" fill="none" opacity=".75"/>`).join('');
  } else {
    g += `<path d="M82 151 Q100 166 118 151" fill="none" stroke="${INK}" stroke-width="4"/>`;
  }
  if (acc === 'Fwog') g += `<g transform="translate(150 158)"><ellipse cx="0" cy="8" rx="16" ry="12" fill="#6ac46a" stroke="${INK}" stroke-width="3.5"/><circle cx="-7" cy="-2" r="6" fill="#fff" stroke="${INK}" stroke-width="3"/><circle cx="7" cy="-2" r="6" fill="#fff" stroke="${INK}" stroke-width="3"/><circle cx="-6" cy="-2" r="2.2" fill="${INK}"/><circle cx="8" cy="-2" r="2.2" fill="${INK}"/><path d="M-6 10 Q0 14 6 10" stroke="${INK}" stroke-width="2.5" fill="none"/></g>`;
  if (acc === 'Knife') g += `<g transform="translate(152 150) rotate(25)"><path d="M0 0 L5 -34 L10 0 Z" fill="#dfe6ee" stroke="${INK}" stroke-width="3"/><rect x="-3" y="0" width="16" height="6" fill="${INK}"/><rect x="2" y="6" width="6" height="14" fill="#8b5a2b" stroke="${INK}" stroke-width="2.5"/></g>`;
  if (acc === 'Heart') g += `<path d="M150 170 c-8 -12 -24 -2 -12 10 l12 12 l12 -12 c12 -12 -4 -22 -12 -10z" fill="#ff4d8d" stroke="${INK}" stroke-width="3.5"/>`;
  if (acc === 'Coin') g += `<circle cx="152" cy="174" r="13" fill="#f2c230" stroke="${INK}" stroke-width="3.5"/><text x="152" y="180" text-anchor="middle" font-family="Impact,sans-serif" font-size="15" fill="${INK}">C</text>`;
  if (/candle/i.test(acc || '')) { const cc = /green/i.test(acc) ? '#2ecc71' : '#e63946'; g += `<rect x="146" y="150" width="14" height="36" fill="${cc}" stroke="${INK}" stroke-width="3.5"/><path d="M153 140 L153 192" stroke="${INK}" stroke-width="3"/>`; }
  return g;
}

function hat(head, rng) {
  const h = (head || '').toLowerCase(), c = colorFor(head, 'hat');
  if (!head || /none/.test(h)) return '';
  if (/crown/.test(h)) return crownSVG(100, 46, 1.25);
  if (/wizard/.test(h) && !/beanie/.test(h)) return `<path d="M44 66 L104 -6 L150 66 Z" fill="${c}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><path d="M30 68 Q100 50 172 68 Q100 84 30 68 Z" fill="${c}" stroke="${INK}" stroke-width="5"/><text x="98" y="48" font-size="18" text-anchor="middle" fill="#ffe14d">★</text>`;
  if (/bucket/.test(h)) return `<path d="M50 70 C 52 26, 148 26, 150 70 Z" fill="${c}" stroke="${INK}" stroke-width="5"/><path d="M26 78 Q100 52 174 78 Q100 92 26 78 Z" fill="${c}" stroke="${INK}" stroke-width="5"/>`;
  if (/headband/.test(h)) return `<path d="M36 68 Q100 52 164 68 L164 84 Q100 68 36 84 Z" fill="${/japan/.test(h) ? '#fff' : '#e63946'}" stroke="${INK}" stroke-width="4.5"/>${/japan/.test(h) ? '<circle cx="100" cy="70" r="6" fill="#e63946"/>' : ''}<path d="M164 72 L186 64 M164 78 L184 88" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
  if (/wig|hair/.test(h)) return ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'].map((cl, i) => `<circle cx="${50 + i * 25}" cy="${44 + (i % 2) * 8}" r="${24}" fill="${/bob/.test(h) ? '#3b2a20' : cl}" stroke="${INK}" stroke-width="4.5"/>`).join('');
  if (/helmet/.test(h)) return `<path d="M36 90 C 34 22, 166 22, 164 90 L150 92 L150 70 L50 70 L50 92 Z" fill="#c9a227" stroke="${INK}" stroke-width="5"/><path d="M70 22 Q100 -14 130 22" fill="#d62828" stroke="${INK}" stroke-width="5"/>`;
  if (/russian/.test(h)) return `<path d="M40 72 C 40 20, 160 20, 160 72 Z" fill="#6b4f3a" stroke="${INK}" stroke-width="5"/><rect x="34" y="62" width="132" height="18" rx="9" fill="#8a6a4f" stroke="${INK}" stroke-width="5"/>`;
  if (/durag|robber/.test(h)) return `<path d="M36 74 C 36 18, 164 18, 164 74 Q100 60 36 74 Z" fill="${/robber/.test(h) ? '#1c1c1c' : c}" stroke="${INK}" stroke-width="5"/><path d="M160 66 Q186 80 176 104" stroke="${INK}" stroke-width="5" fill="none"/>`;
  if (/clown nose/.test(h)) return `<circle cx="100" cy="106" r="11" fill="#e63946" stroke="${INK}" stroke-width="4"/>`;
  if (/3rd eye/.test(h)) return `<ellipse cx="100" cy="58" rx="12" ry="8" fill="#fff" stroke="${INK}" stroke-width="4"/><circle cx="100" cy="58" r="4.5" fill="#836ef9"/>`;
  if (/thorn/.test(h)) return `<path d="M40 60 Q100 40 160 60" stroke="#b0b7c3" stroke-width="7" fill="none"/>` + [52, 76, 100, 124, 148].map(x => `<path d="M${x} 52 l4 -12 l4 12" fill="#b0b7c3" stroke="${INK}" stroke-width="2.5"/>`).join('');
  // the classic: a slogan cap (or beanie) with the brim cocked sideways
  const beanie = /beanie/.test(h), txt = capText(head), fs = txt.length > 6 ? 15 : txt.length > 4 ? 19 : 24;
  const dark = /black|dark|navy/.test(h) || /hsl\(2[2-9]\d/.test(c);
  let g = beanie
    ? `<path d="M38 74 C 38 14, 162 14, 162 74 Z" fill="${c}" stroke="${INK}" stroke-width="5"/><rect x="34" y="62" width="132" height="20" rx="8" fill="${c}" stroke="${INK}" stroke-width="5"/>` + [50, 66, 82, 98, 114, 130, 146].map(x => `<path d="M${x} 65 v14" stroke="${INK}" stroke-width="2" opacity=".5"/>`).join('')
    : `<path d="M110 68 Q 176 58 196 76 Q 176 90 110 80 Z" fill="${c}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><path d="M36 76 C 36 16, 164 16, 164 76 Q100 66 36 76 Z" fill="${c}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><circle cx="100" cy="24" r="4" fill="${INK}"/>`;
  g += `<text x="100" y="${beanie ? 52 : 58}" text-anchor="middle" font-family="Impact, 'Arial Black', sans-serif" font-size="${fs}" fill="${dark ? '#fff' : '#fff'}" stroke="${INK}" stroke-width="3" paint-order="stroke" letter-spacing="1">${esc(txt)}</text>`;
  return g;
}

function crownSVG(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-34 14 L-38 -22 L-18 -4 L0 -30 L18 -4 L38 -22 L34 14 Z" fill="#ffd23f" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/><circle cx="0" cy="-2" r="5" fill="#e63946" stroke="${INK}" stroke-width="2.5"/><circle cx="-20" cy="4" r="3.5" fill="#3a86ff" stroke="${INK}" stroke-width="2"/><circle cx="20" cy="4" r="3.5" fill="#2ecc71" stroke="${INK}" stroke-width="2"/></g>`;
}

const eye = (x, y, rx = 11, ry = 14) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${INK}"/><circle cx="${x + 3.5}" cy="${y - 5}" r="4" fill="#fff"/><circle cx="${x - 4}" cy="${y + 5}" r="1.8" fill="#fff"/>`;
function eyes(kind, rugged) {
  const k = (kind || '').toLowerCase(), L = 74, R = 126, Y = 98;
  if (rugged || /dead|xd/.test(k)) return [L, R].map(x => `<path d="M${x - 10} ${Y - 10} l20 20 M${x + 10} ${Y - 10} l-20 20" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`).join('');
  let g = '';
  if (/happy|closed/.test(k)) g = [L, R].map(x => `<path d="M${x - 12} ${Y + 4} Q${x} ${Y - 12} ${x + 12} ${Y + 4}" stroke="${INK}" stroke-width="6" fill="none" stroke-linecap="round"/>`).join('');
  else if (/heart/.test(k)) g = [L, R].map(x => `<path d="M${x} ${Y + 10} l-12 -12 c-8 -8 4 -18 12 -8 c8 -10 20 0 12 8 z" fill="#ff3b6b" stroke="${INK}" stroke-width="3.5"/>`).join('');
  else if (/visor/.test(k)) g = `<path d="M44 86 Q100 74 156 86 L152 108 Q100 98 48 108 Z" fill="${/sunset/.test(k) ? 'url(#sunset)' : /plasma/.test(k) ? '#3ad6e8' : '#836ef9'}" stroke="${INK}" stroke-width="5"/><path d="M60 90 L90 86" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".8"/>`;
  else if (/vr/.test(k)) g = `<rect x="44" y="80" width="112" height="34" rx="10" fill="#2d2d3a" stroke="${INK}" stroke-width="5"/><rect x="54" y="88" width="92" height="8" rx="4" fill="${/modern/.test(k) ? '#3ad6e8' : '#ff4d6d'}"/>`;
  else if (/tired|flat|smirk/.test(k)) g = [L, R].map(x => `<path d="M${x - 12} ${Y - 2} h24" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="M${x - 9} ${Y} q9 9 18 0" fill="${INK}"/>`).join('');
  else if (/side/.test(k)) g = [L, R].map(x => `<ellipse cx="${x}" cy="${Y}" rx="12" ry="12" fill="#fff" stroke="${INK}" stroke-width="4"/><circle cx="${x + 6}" cy="${Y}" r="6" fill="${/green/.test(k) ? '#2ecc71' : INK}"/>`).join('');
  else if (/frog|vertical|mog/.test(k)) g = [L, R].map(x => `<circle cx="${x}" cy="${Y - 4}" r="15" fill="#fff" stroke="${INK}" stroke-width="4.5"/><rect x="${x - 3}" y="${Y - 14}" width="6" height="20" rx="3" fill="${INK}"/>`).join('');
  else g = eye(L, Y) + eye(R, Y);
  if (/angry|thug|viper/.test(k)) g += `<path d="M60 80 L88 88 M140 80 L112 88" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`;
  if (/worried|sad/.test(k)) g += `<path d="M60 86 L86 78 M140 86 L114 78" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
  if (/glass|clown/.test(k)) {
    const fc = /btc/.test(k) ? '#f7931a' : /retro/.test(k) ? '#e63946' : /anime/.test(k) ? '#3a86ff' : /3d/.test(k) ? '#3ad6e8' : '#262626';
    g += `<g fill="${/3d/.test(k) ? 'rgba(58,214,232,.25)' : 'none'}" stroke="${fc}" stroke-width="5"><rect x="54" y="82" width="40" height="32" rx="8"/><rect x="106" y="82" width="40" height="32" rx="8"/><path d="M94 96 h12 M54 92 L40 86 M146 92 L160 86"/></g>`;
  }
  if (/cry|tear|teary/.test(k)) g += [L, R].map(x => `<path d="M${x - 6} ${Y + 12} q-4 26 4 46" stroke="#5ec8ff" stroke-width="7" fill="none" stroke-linecap="round" opacity=".85"/>`).join('');
  if (/laser/.test(k)) {
    const lc = /green/.test(k) ? '#39ff14' : /purple/.test(k) ? '#b06cff' : /cyan/.test(k) ? '#3ad6e8' : '#ff3b1f';
    g = [L, R].map(x => `<path d="M${x} ${Y} L${x - 140} ${Y + 64} L${x - 140} ${Y + 84} Z" fill="${lc}" opacity=".9"/><path d="M${x} ${Y} L${x - 140} ${Y + 72}" stroke="#fff6a8" stroke-width="5"/>`).join('') + g;
  }
  return g;
}

function mouth(kind) {
  const k = (kind || '').toLowerCase();
  const grin = `<path d="M70 120 Q100 152 130 120 Q100 128 70 120 Z" fill="#fff" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/><path d="M76 124 Q100 134 124 124" stroke="${INK}" stroke-width="2" fill="none" opacity=".6"/>`;
  if (/sad/.test(k)) return `<path d="M80 134 Q100 118 120 134" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  if (/worried/.test(k)) return `<path d="M78 130 q7 -7 14 0 t14 0 t14 0" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  if (/flat/.test(k)) return `<path d="M82 128 h36" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
  if (/^wo$/.test(k)) return `<ellipse cx="100" cy="128" rx="9" ry="11" fill="#7a1f2b" stroke="${INK}" stroke-width="4.5"/>`;
  if (/bubble/.test(k)) return grin + `<circle cx="112" cy="132" r="15" fill="#ff8fc7" stroke="${INK}" stroke-width="4"/><circle cx="107" cy="126" r="4" fill="#fff" opacity=".8"/>`;
  if (/puke/.test(k)) return grin + ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'].map((c, i) => `<path d="M${90 + i * 5} 130 Q ${92 + i * 6} 170 ${80 + i * 9} 204" stroke="${c}" stroke-width="5" fill="none"/>`).join('');
  if (/coin/.test(k)) return grin + `<circle cx="100" cy="132" r="12" fill="${/mon/.test(k) ? '#836ef9' : '#f7931a'}" stroke="${INK}" stroke-width="4"/><text x="100" y="137" text-anchor="middle" font-family="Impact,sans-serif" font-size="13" fill="#fff">${/mon/.test(k) ? 'M' : '₿'}</text>`;
  if (/clown/.test(k)) return `<path d="M64 118 Q100 160 136 118 Q100 132 64 118 Z" fill="#e63946" stroke="${INK}" stroke-width="4.5"/>`;
  if (/drool/.test(k)) return grin + `<path d="M118 130 q4 14 0 22 q-6 4 -6 -4 z" fill="#8fd3ff" stroke="${INK}" stroke-width="2.5"/>`;
  if (/lip/.test(k)) return `<path d="M80 124 Q100 136 120 124" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M94 126 l3 6 l3 -6 l3 6 l3 -6" stroke="${INK}" stroke-width="2" fill="#fff"/>`;
  if (/grit/.test(k)) return `<rect x="76" y="118" width="48" height="16" rx="5" fill="#fff" stroke="${INK}" stroke-width="4.5"/><path d="M88 118 v16 M100 118 v16 M112 118 v16 M76 126 h48" stroke="${INK}" stroke-width="2"/>`;
  let g = grin;
  if (/gold/.test(k)) g += `<rect x="102" y="124" width="9" height="9" rx="2" fill="#f2c230" stroke="${INK}" stroke-width="2.5"/>`;
  else g += `<rect x="92" y="124" width="7" height="6" fill="#f2c230" stroke="${INK}" stroke-width="2"/>`; // every Chog has a little gold
  return g;
}

function stickers(st) {
  let g = '';
  if (st.scars) g += `<path d="M118 78 L138 112" stroke="#b3123a" stroke-width="5" stroke-linecap="round"/>` + [0, 1, 2].map(i => `<path d="M${120 + i * 7} ${94 + i * 6} l9 -5" stroke="#b3123a" stroke-width="3" stroke-linecap="round"/>`).join('');
  if (st.bandage) g += `<g transform="rotate(-18 64 74)"><rect x="40" y="66" width="48" height="16" rx="7" fill="#f6dcb5" stroke="${INK}" stroke-width="3.5"/><path d="M54 70 v8 M64 70 v8 M74 70 v8" stroke="${INK}" stroke-width="2" opacity=".5"/></g>`;
  if (st.married) g += `<g transform="translate(30 150)"><circle r="11" fill="none" stroke="#f2c230" stroke-width="5"/><circle r="11" fill="none" stroke="${INK}" stroke-width="1.5"/><path d="M-6 -12 l6 -8 l6 8 z" fill="#8fd3ff" stroke="${INK}" stroke-width="2.5"/></g>`;
  if (st.stabbed) g += `<g transform="translate(150 40) rotate(35)"><path d="M0 0 L6 -40 L12 0 Z" fill="#e8eef5" stroke="${INK}" stroke-width="3.5"/><rect x="-6" y="0" width="24" height="7" fill="#7a1f2b" stroke="${INK}" stroke-width="2.5"/><rect x="2" y="7" width="8" height="18" fill="#3b2a20" stroke="${INK}" stroke-width="2.5"/></g>`;
  if (st.king) g += crownSVG(100, 22, 1.05);
  if (st.shamed) g += `<text x="100" y="192" text-anchor="middle" font-family="Impact,'Arial Black',sans-serif" font-size="38" fill="#ff2e63" stroke="${INK}" stroke-width="3" paint-order="stroke" transform="rotate(-8 100 180)">SHAME</text>`;
  if (st.rugged) g += `<text x="100" y="40" text-anchor="middle" font-family="Impact,'Arial Black',sans-serif" font-size="34" fill="#ffd23f" stroke="${INK}" stroke-width="3" paint-order="stroke" transform="rotate(6 100 30)">RUGGED</text>`;
  return g;
}

/**
 * @param traits Chog traits (Background, Skin, Body, Mouth, Eyes, Head, Accessory, Form, Base, Side, Aura)
 * @param st optional stickers: { king, scars, bandage, married, stabbed, shamed, rugged }
 */
export function chogSVG(traits = {}, st = {}, { bg = true, wobble = true } = {}) {
  let seed = hashStr(JSON.stringify(traits));
  const rng = k => { seed = (seed * 1664525 + 1013904223) >>> 0; return (seed / 4294967296) * k; };
  const skull = traits.Form === 'Skull' || traits.Base === 'Skull';
  const face = skull ? '#e9e4da' : traits.Base === 'Radioactive' ? '#e6ffb0' : '#fff6e9';
  const bgc = BG[traits.Background] || `hsl(${hashStr(traits.Background || '') % 360} 80% 75%)`;
  const flip = traits.Side === 'Left';
  const fid = 'w' + (hashStr(JSON.stringify(traits) + JSON.stringify(st)) % 1e6);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs>`;
  s += `<filter id="${fid}" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="${seed % 97}"/><feDisplacementMap in="SourceGraphic" scale="${wobble ? 3.2 : 0}"/></filter>`;
  s += `<linearGradient id="sunset" x1="0" x2="1"><stop offset="0" stop-color="#ff5f6d"/><stop offset=".5" stop-color="#ffc371"/><stop offset="1" stop-color="#b06cff"/></linearGradient></defs>`;
  if (bg) {
    s += `<rect width="200" height="200" fill="${bgc}"/>`;
    for (let i = 0; i < 14; i++) s += `<circle cx="${rng(200).toFixed(0)}" cy="${rng(200).toFixed(0)}" r="${(1 + rng(5)).toFixed(1)}" fill="#000" opacity=".07"/>`; // spray specks
  }
  if (traits.Aura) s += `<circle cx="100" cy="100" r="92" fill="none" stroke="${colorFor(traits.Aura, 'aura')}" stroke-width="14" opacity=".45"/>`;
  s += `<g filter="url(#${fid})"><g${flip ? ' transform="translate(200 0) scale(-1 1)"' : ''}>`;
  s += body(traits.Body, traits.Accessory);
  s += quills(SKIN[traits.Skin] || '#ff4d6d', rng);
  s += `<path d="M36 100 C 34 52, 70 40, 100 40 C 130 40, 166 52, 164 100 C 166 140, 136 152, 100 152 C 64 152, 34 140, 36 100 Z" fill="${face}" stroke="${INK}" stroke-width="5.5" stroke-linejoin="round"/>`;
  if (skull) s += `<path d="M88 112 l12 -12 l12 12" fill="${INK}"/>`;
  s += `<ellipse cx="60" cy="118" rx="13" ry="7.5" fill="#ff8fa3" opacity=".85"/><ellipse cx="140" cy="118" rx="13" ry="7.5" fill="#ff8fa3" opacity=".85"/>`;
  s += `<path d="M53 115 l4 6 M59 114 l4 6 M133 115 l4 6 M139 114 l4 6" stroke="${INK}" stroke-width="1.6" opacity=".5"/>`;
  s += mouth(traits.Mouth) + eyes(traits.Eyes, st.rugged);
  s += `</g>${jersey}${hat(traits.Head, rng)}${stickers(st)}</g></svg>`; // hat outside the flip so slogans stay readable
  return s;
}

/** Just the stickers, on a transparent square: laid over real Genesis art so the NFT itself wears its history. */
export const stickerLayerSVG = st => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">${stickers(st)}</svg>`;

export const chogDataURL = (traits, st, o) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(chogSVG(traits, st, o));
