// Everything the server says to Monad: who owns which Chog, login signatures, gasless mints and the daily seal.
// CHAIN_MODE=mainnet reads the real Chog Genesis; CHAIN_MODE=testnet (the default) reads our MockChogGenesis.
import fs from 'node:fs';
import { createPublicClient, createWalletClient, http, defineChain, parseAbi, keccak256, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { GENESIS, MONAD, MONAD_TESTNET, SUPPLY } from '../shared/chain.js';
import { HOUSES } from '../shared/game.js';

export const MODE = process.env.CHAIN_MODE || 'testnet';
const NET = MODE === 'mainnet' ? MONAD : MONAD_TESTNET;
const deployments = fs.existsSync('data/deployments.json') ? JSON.parse(fs.readFileSync('data/deployments.json', 'utf8')) : {};
export const D = { genesis: MODE === 'mainnet' ? GENESIS : null, ...(deployments[MODE] || {}) };
const chain = defineChain({ id: NET.id, name: NET.name, nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 }, rpcUrls: { default: { http: [process.env.RPC_URL || NET.rpc] } },
  contracts: { multicall3: { address: '0xcA11bde05977b3631167028862bE2a173976CA11' } } });
export const pub = createPublicClient({ chain, transport: http() });
const account = process.env.RELAYER_KEY ? privateKeyToAccount(process.env.RELAYER_KEY) : null;
const wallet = account ? createWalletClient({ chain, account, transport: http() }) : null;
const ERC721 = parseAbi(['function ownerOf(uint256) view returns (address)']);
const NOBLES = parseAbi(['function mint(address to, uint256 id, uint256 parentA, uint256 parentB)']);
const LEDGER = fs.existsSync('contracts/out/ChogLedger.json') ? JSON.parse(fs.readFileSync('contracts/out/ChogLedger.json', 'utf8')).abi : [];
const KIND = { genesis: 1, bastard: 2, heir: 3 };
export const nobleKey = n => (BigInt(KIND[n.kind]) << 248n) | BigInt(n.id);
export const chainInfo = () => ({ mode: MODE, chainId: NET.id, rpc: NET.rpc, explorer: NET.explorer, ...D, relayer: account?.address || null, faucet: MODE === 'testnet' && !!D.genesis && !!wallet });

/** Testnet only: the relayer (owner of MockChogGenesis) mints one test Chog to a judge. Waits for the receipt. */
export async function faucetMint(to, id) {
  if (MODE !== 'testnet' || !D.genesis || !wallet) throw new Error('The test-Chog faucet only runs on testnet.');
  const abi = parseAbi(['function mint(address to, uint256[] ids)']);
  const hash = await wallet.writeContract({ address: D.genesis, abi, functionName: 'mint', args: [to, [BigInt(id)]] });
  await pub.waitForTransactionReceipt({ hash, timeout: 60_000 });
  owners[id] = to.toLowerCase(); ownerCache.set(id, { o: to.toLowerCase(), t: Date.now() });
  return hash;
}

// Local testing without holding a Chog: DEV_OWNS="0xabc…:1,2,3;0xdef…:4" (ignored on mainnet)
const devOwns = {};
if (MODE !== 'mainnet') for (const part of (process.env.DEV_OWNS || '').split(';').filter(Boolean)) {
  const [addr, ids] = part.split(':');
  for (const id of ids.split(',')) devOwns[+id] = addr.toLowerCase();
}

let owners = { ...devOwns }, ownersAt = 0, refreshing = null;
export const ownersMap = () => owners;
/** All 1,969 owners in a few multicalls, at most every 2 minutes. */
export function refreshOwners(force = false) {
  if (!force && Date.now() - ownersAt < 120_000) return Promise.resolve(owners);
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const next = {};
    if (D.genesis) {
      const ids = Array.from({ length: SUPPLY }, (_, i) => i + 1);
      for (let i = 0; i < ids.length; i += 500) {
        const chunk = ids.slice(i, i + 500);
        const res = await pub.multicall({ contracts: chunk.map(id => ({ address: D.genesis, abi: ERC721, functionName: 'ownerOf', args: [BigInt(id)] })), allowFailure: true });
        res.forEach((r, j) => { if (r.status === 'success') next[chunk[j]] = r.result.toLowerCase(); });
      }
    }
    owners = { ...next, ...devOwns }; ownersAt = Date.now();
    return owners;
  })().catch(e => { console.warn('[chain] owners', e.shortMessage || e.message); return owners; }).finally(() => { refreshing = null; });
  return refreshing;
}
const ownerCache = new Map();
/** Live ownerOf for one token (15 s cache), so a sold Chog stops obeying its old lord at once. */
export async function ownerOf(id) {
  if (devOwns[id]) return devOwns[id];
  if (!D.genesis) return null;
  const c = ownerCache.get(id);
  if (c && Date.now() - c.t < 15_000) return c.o;
  const o = await pub.readContract({ address: D.genesis, abi: ERC721, functionName: 'ownerOf', args: [BigInt(id)] }).then(a => a.toLowerCase()).catch(() => null);
  ownerCache.set(id, { o, t: Date.now() });
  if (o) owners[id] = o;
  return o;
}

/** EOAs and smart wallets (ERC-1271/6492) alike. */
export async function verifyLogin(address, message, signature) {
  try { return await pub.verifyMessage({ address, message, signature }); } catch { return false; }
}

// ---------------------------------------------------------------- writes, queued so a slow RPC never blocks a move
const queue = [];
let busy = false;
async function pump() {
  if (busy || !queue.length || !wallet) return;
  busy = true;
  const job = queue.shift();
  try {
    const hash = await job.send();
    await pub.waitForTransactionReceipt({ hash, timeout: 60_000 });
    job.done?.(hash);
    console.log('[chain]', job.label, hash);
  } catch (e) {
    job.tries = (job.tries || 0) + 1;
    console.warn('[chain]', job.label, 'failed:', e.shortMessage || e.message);
    if (job.tries < 4) queue.push(job);
  }
  busy = false;
  setTimeout(pump, 300);
}
// On Vercel nothing may run after the reply, so each job is sent and confirmed inside the request (Monad confirms in about a second).
async function runNow(job) {
  for (let tries = 1; ; tries++) {
    try {
      const hash = await job.send();
      await pub.waitForTransactionReceipt({ hash, timeout: 20_000 });
      job.done?.(hash);
      return console.log('[chain]', job.label, hash);
    } catch (e) {
      console.warn('[chain]', job.label, 'failed:', e.shortMessage || e.message);
      if (tries >= 2) return;
    }
  }
}
const enqueue = job => { if (process.env.VERCEL) return wallet ? runNow(job) : null; queue.push(job); pump(); };

/** The highest Bastard or Chogling id already minted, so a fresh world (or one after test runs) never reuses a token id. */
export async function lastMintedId(kind, from) {
  const addr = kind === 'bastard' ? D.bastards : D.choglings;
  if (!addr) return from;
  const supply = Number(await pub.readContract({ address: addr, abi: parseAbi(['function totalSupply() view returns (uint256)']), functionName: 'totalSupply' }));
  let id = Math.max(from, supply);
  while (await pub.readContract({ address: addr, abi: ERC721, functionName: 'ownerOf', args: [BigInt(id + 1)] }).then(() => true, () => false)) id++;
  return id;
}

/** Mint a Bastard or Chogling NFT to its lord. Parents are recorded on-chain for heirs. */
export function mintNoble(n, parents, done) {
  const addr = n.kind === 'bastard' ? D.bastards : D.choglings;
  if (!addr || !n.owner) return false;
  const [pa, pb] = parents || [0n, 0n];
  return enqueue({ label: `mint ${n.key}`, done, send: () => wallet.writeContract({ address: addr, abi: NOBLES, functionName: 'mint', args: [n.owner, BigInt(n.id), pa, pb] }) });
}

/** Close a day on-chain: every claimed noble's record (plus the king), the Raven's hash and the king's key. */
export async function sealDay(w, day, titleIds, done) {
  if (!D.ledger || !wallet) return;
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
    await enqueue({ label: `seal day ${day} (${batch.length})`, done: i === 0 ? done : null, send: () => wallet.writeContract({ address: D.ledger, abi: LEDGER, functionName: 'seal', args: [day, raven, king, batch] }) });
  }
}
