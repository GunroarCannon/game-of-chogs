// (from royal-ramble) Optional off-site copy of the data folder, for free hosts whose disk is wiped on every restart or sleep
// (Render free, Koyeb, Hugging Face Spaces). Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (free at
// upstash.com) and every shared world and player profile is mirrored to Redis, then copied back to disk
// on startup. Without them, the disk is all there is.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Vercel's filesystem is read-only except /tmp: default the data folder there so a missing DATA_DIR cannot crash the function.
// (This module is imported first by server/index.js, so the others see it.)
if (process.env.VERCEL && !process.env.DATA_DIR) process.env.DATA_DIR = '/tmp/goc-data';

const URL =(process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/$/, '');
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';
export const remote = !!(URL && TOKEN);
const PREFIX = process.env.STORE_PREFIX || 'goc:';
const DATA = path.resolve(process.env.DATA_DIR || 'data');
// On Vercel every request may land on a fresh, short-lived function: no disk, no timers that outlive the response.
export const serverless = !!process.env.VERCEL;

/** fetch with one retry on a network failure (a dropped connection, not an error reply) */
const post = (url, body) => fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(8000) })
  .catch(() => fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(8000) }));
async function redis(...cmd) {
  const r = await post(URL, JSON.stringify(cmd));
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || `redis ${r.status}`);
  return j.result;
}

// `rel` is a path inside the data folder, e.g. "worlds/ab12cd34.json"; it doubles as the Redis key.
const last = new Map(), queued = new Map();
const MIN_GAP = 15_000; // at most one write per file every 15 s keeps a busy world well inside the free quota

/** Mirror a file's new contents off-site (throttled; the latest version always wins). */
export function mirror(rel, json) {
  if (!remote) return;
  queued.set(rel, json);
  if (serverless) return push(rel);
  if (last.has(rel + ':timer')) return;
  const wait = Math.max(0, (last.get(rel) || 0) + MIN_GAP - Date.now());
  last.set(rel + ':timer', setTimeout(() => { last.delete(rel + ':timer'); push(rel); }, wait));
}
/** Forget a file off-site too (a deleted world must not come back from Redis on the next start). */
export function unmirror(rel) {
  queued.delete(rel);
  if (!remote) return Promise.resolve();
  return redis('DEL', PREFIX + rel).catch(e => console.warn('[store] unmirror failed', rel, e.message));
}
function push(rel) {
  const json = queued.get(rel);
  if (json == null) return Promise.resolve();
  queued.delete(rel);
  last.set(rel, Date.now());
  return redis('SET', PREFIX + rel, json).catch(e => console.warn('[store] mirror failed', rel, e.message));
}

/** On the way out: send everything still waiting, but never hang a shutdown for long. */
export function flushAll(ms = 4000) {
  if (!remote || !queued.size) return Promise.resolve();
  for (const k of [...last.keys()]) if (k.endsWith(':timer')) { clearTimeout(last.get(k)); last.delete(k); }
  return Promise.race([Promise.all([...queued.keys()].map(push)), new Promise(r => setTimeout(r, ms))]);
}

/** Small JSON documents straight in Redis (serverless profiles and live audiences; no disk involved). */
export const kv = {
  async get(key) { const v = await redis('GET', PREFIX + key); return v == null ? null : JSON.parse(v); },
  async set(key, val, ttlSec) { await redis(...(ttlSec ? ['SET', PREFIX + key, JSON.stringify(val), 'EX', ttlSec] : ['SET', PREFIX + key, JSON.stringify(val)])); },
  async del(key) { await redis('DEL', PREFIX + key); },
  /** Append to a capped list (newest last). */
  async push(key, items, max) { await redis('RPUSH', PREFIX + key, ...items.map(i => JSON.stringify(i))); await redis('LTRIM', PREFIX + key, -max, -1); },
  async list(key, n) { return ((await redis('LRANGE', PREFIX + key, -n, -1)) || []).map(s => JSON.parse(s)); },
};

/** Serverless: the world is one gzipped document plus a version stamp, so a warm function only re-downloads it after
 * someone else changed it. Writers take a short lock so two instances never overwrite each other's moves. */
async function pipeline(cmds) {
  const r = await post(URL + '/pipeline', JSON.stringify(cmds));
  const j = await r.json().catch(() => null);
  if (!r.ok || !Array.isArray(j) || j.some(x => x.error)) throw new Error('redis pipeline ' + r.status);
  return j.map(x => x.result);
}
export const doc = {
  ver: rel => redis('GET', PREFIX + rel + '.ver'),
  get: rel => redis('GET', PREFIX + rel),
  async put(rel, val) { const ver = crypto.randomUUID(); await pipeline([['SET', PREFIX + rel, val], ['SET', PREFIX + rel + '.ver', ver]]); return ver; },
};
export async function withLock(name, fn, ttl = 30_000) {
  const key = PREFIX + name + '.lock', id = crypto.randomUUID();
  for (let i = 0; (await redis('SET', key, id, 'NX', 'PX', ttl)) !== 'OK'; i++) {
    if (i > 50) throw Object.assign(new Error('The realm is busy. Try again in a moment.'), { status: 503 });
    await new Promise(r => setTimeout(r, 120 + Math.random() * 180));
  }
  try { return await fn(); } finally { await redis('DEL', key).catch(() => {}); }
}

// Copy everything back to disk before the rest of the server reads it (always-on hosts only).
if (remote && !serverless) {
  try {
    const keys = await redis('KEYS', PREFIX + '*');
    for (let i = 0; i < keys.length; i += 20) {
      const batch = keys.slice(i, i + 20);
      const vals = await redis('MGET', ...batch);
      batch.forEach((k, j) => {
        if (vals[j] == null) return;
        const rel = k.slice(PREFIX.length);
        if (rel.includes('..')) return;
        const file = path.join(DATA, rel);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, vals[j]);
      });
    }
    console.log(`[store] restored ${keys.length} file(s) from Upstash Redis`);
  } catch (e) { console.warn('[store] restore failed, starting from local disk:', e.message); }
}
