// Everything the server says to Monad: who owns which Chog, login signatures, gasless mints and the daily seal.
// Both networks stay wired up. The player picks one on the gate (X-Net header); CHAIN_MODE only sets the default,
// which is also what cron and boot-time work use. mainnet reads the real Chog Genesis, testnet our MockChogGenesis.
import fs from 'node:fs';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createPublicClient, createWalletClient, http, defineChain, parseAbi, keccak256, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { GENESIS, MONAD, MONAD_TESTNET, SUPPLY } from '../shared/chain.js';
import { HOUSES } from '../shared/game.js';

export const MODE = process.env.CHAIN_MODE === 'mainnet' ? 'mainnet' : 'testnet';
const deployments = fs.existsSync('data/deployments.json') ? JSON.parse(fs.readFileSync('data/deployments.json', 'utf8')) : {};
const account = process.env.RELAYER_KEY ? privateKeyToAccount(process.env.RELAYER_KEY) : null;
const ERC721 = parseAbi(['function ownerOf(uint256) view returns (address)']);
const NOBLES = parseAbi(['function mint(address to, uint256 id, uint256 parentA, uint256 parentB)']);
const LEDGER = fs.existsSync('contracts/out/ChogLedger.json') ? JSON.parse(fs.readFileSync('contracts/out/ChogLedger.json', 'utf8')).abi : [];
const KIND = { genesis: 1, bastard: 2, heir: 3 };
export const nobleKey = n => (BigInt(KIND[n.kind]) << 248n) | BigInt(n.id);

// Local testing without holding a Chog: DEV_OWNS="0xabc:1,2,3;0xdef:4" (testnet only)
const devOwns = {};
for (const part of (process.env.DEV_OWNS || '').split(';').filter(Boolean)) {
  const [addr, ids] = part.split(':');
  for (const id of ids.split(',')) devOwns[+id] = addr.toLowerCase();
}

function makeNet(mode) {
  const NET = mode === 'mainnet' ? MONAD : MONAD_TESTNET;
  const D = { genesis: mode === 'mainnet' ? GENESIS : null, ...(deployments[mode] || {}) };
  const chain = defineChain({ id: NET.id, name: NET.name, nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 }, rpcUrls: { default: { http: [mode === MODE && process.env.RPC_URL || NET.rpc] } },
    contracts: { multicall3: { address: '0xcA11bde05977b3631167028862bE2a173976CA11' } } });
  const dev = mode === 'mainnet' ? {} : devOwns;
  return { mode, NET, D, pub: createPublicClient({ chain, transport: http() }), wallet: account ? createWalletClient({ chain, account, transport: http() }) : null,
    dev, owners: { ...dev }, ownersAt: 0, refreshing: null, ownerCache: new Map(), queue: [], busy: false };
}
const NETS = { mainnet: makeNet('mainnet'), testnet: makeNet('testnet') };
const als = new AsyncLocalStorage();
const cx = () => als.getStore() || NETS[MODE];
export const currentNet = () => cx().mode;
export const netOf = req => { const n = req.get?.('x-net'); return NETS[n] ? n : MODE; };
/** Run fn with every chain call inside it talking to `net`. Re-enter it inside locked(): the lock hands work between requests. */
export const withNet = (net, fn) => als.run(NETS[net] || NETS[MODE], fn);
export const chainInfo = () => { const c = cx(); return { mode: c.mode, defaultMode: MODE, chainId: c.NET.id, rpc: c.NET.rpc, explorer: c.NET.explorer, ...c.D, relayer: account?.address || null, faucet: c.mode === 'testnet' && !!c.D.genesis && !!c.wallet }; };

/** Testnet only: the relayer (owner of MockChogGenesis) mints one test Chog to a judge. Waits for the receipt. */
export async function faucetMint(to, id) {
  const c = cx();
  if (c.mode !== 'testnet' || !c.D.genesis || !c.wallet) throw new Error('The test-Chog faucet only runs on testnet.');
  const abi = parseAbi(['function mint(address to, uint256[] ids)']);
  const hash = await c.wallet.writeContract({ address: c.D.genesis, abi, functionName: 'mint', args: [to, [BigInt(id)]] });
  await c.pub.waitForTransactionReceipt({ hash, timeout: 60_000 });
  c.owners[id] = to.toLowerCase(); c.ownerCache.set(id, { o: to.toLowerCase(), t: Date.now() });
  return hash;
}

export const ownersMap = () => cx().owners;
/** All 1,969 owners in a few multicalls, at most every 2 minutes. */
export function refreshOwners(force = false) {
  const c = cx();
  if (!force && Date.now() - c.ownersAt < 120_000) return Promise.resolve(c.owners);
  if (c.refreshing) return c.refreshing;
  c.refreshing = (async () => {
    const next = {};
    if (c.D.genesis) {
      const ids = Array.from({ length: SUPPLY }, (_, i) => i + 1);
      for (let i = 0; i < ids.length; i += 500) {
        const chunk = ids.slice(i, i + 500);
        const res = await c.pub.multicall({ contracts: chunk.map(id => ({ address: c.D.genesis, abi: ERC721, functionName: 'ownerOf', args: [BigInt(id)] })), allowFailure: true });
        res.forEach((r, j) => { if (r.status === 'success') next[chunk[j]] = r.result.toLowerCase(); });
      }
    }
    c.owners = { ...next, ...c.dev }; c.ownersAt = Date.now();
    return c.owners;
  })().catch(e => { console.warn('[chain] owners', e.shortMessage || e.message); return c.owners; }).finally(() => { c.refreshing = null; });
  return c.refreshing;
}
/** Live ownerOf for one token (15 s cache), so a sold Chog stops obeying its old lord at once. */
export async function ownerOf(id) {
  const c = cx();
  if (c.dev[id]) return c.dev[id];
  if (!c.D.genesis) return null;
  const hit = c.ownerCache.get(id);
  if (hit && Date.now() - hit.t < 15_000) return hit.o;
  const o = await c.pub.readContract({ address: c.D.genesis, abi: ERC721, functionName: 'ownerOf', args: [BigInt(id)] }).then(a => a.toLowerCase()).catch(() => null);
  c.ownerCache.set(id, { o, t: Date.now() });
  if (o) c.owners[id] = o;
  return o;
}

/** EOAs and smart wallets (ERC-1271/6492) alike. */
export async function verifyLogin(address, message, signature) {
  try { return await cx().pub.verifyMessage({ address, message, signature }); } catch { return false; }
}

// ---------------------------------------------------------------- writes, queued so a slow RPC never blocks a move
async function pump(c) {
  if (c.busy || !c.queue.length || !c.wallet) return;
  c.busy = true;
  const job = c.queue.shift();
  try {
    const hash = await job.send();
    await c.pub.waitForTransactionReceipt({ hash, timeout: 60_000 });
    job.done?.(hash);
    console.log('[chain]', job.label, hash);
  } catch (e) {
    job.tries = (job.tries || 0) + 1;
    console.warn('[chain]', job.label, 'failed:', e.shortMessage || e.message);
    if (job.tries < 4) c.queue.push(job);
  }
  c.busy = false;
  setTimeout(() => pump(c), 300);
}
// On Vercel nothing may run after the reply, so each job is sent and confirmed inside the request (Monad confirms in about a second).
async function runNow(c, job) {
  for (let tries = 1; ; tries++) {
    try {
      const hash = await job.send();
      await c.pub.waitForTransactionReceipt({ hash, timeout: 20_000 });
      job.done?.(hash);
      return console.log('[chain]', job.label, hash);
    } catch (e) {
      console.warn('[chain]', job.label, 'failed:', e.shortMessage || e.message);
      if (tries >= 2) return;
    }
  }
}
const enqueue = job => { const c = cx(); if (process.env.VERCEL) return c.wallet ? runNow(c, job) : null; c.queue.push(job); pump(c); };

/** The highest Bastard or Chogling id already minted, so a fresh world (or one after test runs) never reuses a token id. */
export async function lastMintedId(kind, from) {
  const c = cx(), addr = kind === 'bastard' ? c.D.bastards : c.D.choglings;
  if (!addr) return from;
  const supply = Number(await c.pub.readContract({ address: addr, abi: parseAbi(['function totalSupply() view returns (uint256)']), functionName: 'totalSupply' }));
  let id = Math.max(from, supply);
  while (await c.pub.readContract({ address: addr, abi: ERC721, functionName: 'ownerOf', args: [BigInt(id + 1)] }).then(() => true, () => false)) id++;
  return id;
}

/** Mint a Bastard or Chogling NFT to its lord. Parents are recorded on-chain for heirs. */
export function mintNoble(n, parents, done) {
  const c = cx(), addr = n.kind === 'bastard' ? c.D.bastards : c.D.choglings;
  if (!addr || !n.owner) return false;
  const [pa, pb] = parents || [0n, 0n];
  return enqueue({ label: `mint ${n.key}`, done, send: () => c.wallet.writeContract({ address: addr, abi: NOBLES, functionName: 'mint', args: [n.owner, BigInt(n.id), pa, pb] }) });
}

/** Close a day on-chain: every claimed noble's record (plus the king), the Raven's hash and the king's key. */
export async function sealDay(w, day, titleIds, done) {
  const c = cx();
  if (!c.D.ledger || !c.wallet) return;
  const bit = t => 1n << BigInt(Math.max(0, titleIds.indexOf(t)));
  const ups = Object.values(w.nobles).filter(n => n.claimed || n.key === w.throne.king).map(n => ({
    key: nobleKey(n),
    r: { clout: BigInt(n.clout), titles: n.titles.reduce((m, t) => m | bit(t), 0n), day, house: HOUSES.findIndex(h => h.id === n.house),
      scars: n.marks.scars, shames: n.marks.shame, stabWins: n.marks.stabWins,
      spouse: n.spouse && w.nobles[n.spouse] ? nobleKey(w.nobles[n.spouse]) : 0n, liege: n.liege && w.nobles[n.liege] ? nobleKey(w.nobles[n.liege]) : 0n },
  }));
  const raven = keccak256(toHex(JSON.stringify(w.ravens[day] || {})));
  const king = w.throne.king ? nobleKey(w.nobles[w.throne.king]) : 0n;
  for (let i = 0; i === 0 || i < ups.length; i += 150) {
    const batch = ups.slice(i, i + 150);
    await enqueue({ label: `seal day ${day} (${batch.length})`, done: i === 0 ? done : null, send: () => c.wallet.writeContract({ address: c.D.ledger, abi: LEDGER, functionName: 'seal', args: [day, raven, king, batch] }) });
  }
}
