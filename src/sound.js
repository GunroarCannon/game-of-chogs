// Sounds. Samples are tiny and decoded on first click (browsers only allow audio after a gesture).
// The fart and the shame bell are synthesized, so they cost zero bytes.
import { prefs, onPrefs } from './prefs.js';

const SFX = { boom: 'boom.ogg', boom2: 'boom2.mp3', far: 'boom-far.ogg', hit: 'hit.ogg', hit2: 'hit2.ogg', swoosh: 'swoosh.mp3', reveal: 'reveal.mp3',
  levelup: 'levelup.mp3', shame: 'shame.mp3', fanfare: 'fanfare.ogg', tick: 'tick.ogg' };
const LOUD = { boom: 0.32, boom2: 0.3, far: 0.3, hit: 0.36, hit2: 0.36, swoosh: 0.28, reveal: 0.3, levelup: 0.3, shame: 0.34, fanfare: 0.3, tick: 0.2 };
const MUSIC = 0.14;
let ctx = null, muted = false, music = null;
const buf = {};
try { muted = localStorage.getItem('goc:muted') === '1'; } catch {}

export function unlock() {
  if (ctx) return;
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
  for (const f of Object.values(SFX)) buf[f] = fetch('/sfx/' + f).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)).catch(() => null);
}
export const isMuted = () => muted;
export function setMuted(m) {
  muted = m;
  try { localStorage.setItem('goc:muted', m ? '1' : '0'); } catch {}
  if (music) music.volume = m ? 0 : MUSIC * prefs.music * 2;
}
onPrefs(k => { if (k === 'music' && music) music.volume = muted ? 0 : MUSIC * prefs.music * 2; });

export async function sfx(name, rate = 1) {
  if (!ctx || muted) return;
  if (name === 'fart') return fart();
  if (name === 'bell') return bell();
  const b = await buf[SFX[name]];
  if (!b) return;
  const s = ctx.createBufferSource(), g = ctx.createGain();
  s.buffer = b; s.playbackRate.value = rate * (0.94 + Math.random() * 0.12);
  g.gain.value = (LOUD[name] ?? 0.3) * prefs.sfx * 1.4;
  s.connect(g).connect(ctx.destination); s.start();
}

/** A proper wet one: filtered noise with a wobbling low oscillator. */
function fart() {
  const t = ctx.currentTime, dur = 0.45 + Math.random() * 0.5;
  const o = ctx.createOscillator(), og = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
  o.type = 'sawtooth'; o.frequency.setValueAtTime(95 + Math.random() * 40, t); o.frequency.exponentialRampToValueAtTime(48, t + dur);
  lfo.frequency.value = 18 + Math.random() * 14; lg.gain.value = 22; lfo.connect(lg).connect(o.frequency);
  const n = ctx.createBufferSource(), nb = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate), d = nb.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.6;
  n.buffer = nb;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 6;
  og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.0001 + 0.32 * prefs.sfx * 1.4, t + 0.03); og.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(lp); n.connect(lp); lp.connect(og).connect(ctx.destination);
  o.start(t); lfo.start(t); n.start(t); o.stop(t + dur); lfo.stop(t + dur);
}
/** Septa Unella's bell: "Shame. Shame." */
function bell() {
  const t = ctx.currentTime;
  for (const [f, a] of [[660, 0.35], [1320 * 1.01, 0.12], [1980 * 0.99, 0.06]]) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = f; o.type = 'sine';
    g.gain.setValueAtTime(a * 0.6 * prefs.sfx * 1.4 + 0.0001, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 2.2);
  }
}

export function startMusic() {
  if (music) return;
  music = new Audio('/music/march.ogg');
  music.loop = true; music.volume = muted ? 0 : MUSIC * prefs.music * 2;
  music.play().catch(() => { music = null; });
}
