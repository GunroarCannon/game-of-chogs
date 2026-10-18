// One-off: read every Chog Genesis tokenURI from Monad mainnet, fetch its metadata from IPFS and cache the
// traits in data/genesis.json, so the game never depends on a gateway at runtime. Safe to re-run: it resumes.
import fs from 'node:fs';
import { createPublicClient, http, parseAbi } from 'viem';

export const GENESIS = '0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763';
const OUT = 'data/genesis.json', SUPPLY = 1969;
const GATEWAYS = ['https://gateway.pinata.cloud/ipfs/', 'https://ipfs.filebase.io/ipfs/'];
const client = createPublicClient({ transport: http('https://rpc.monad.xyz'), batch: { multicall: true } });
const abi = parseAbi(['function tokenURI(uint256) view returns (string)']);

const db = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
const todo = [];
for (let id = 1; id <= SUPPLY; id++) if (!db[id]) todo.push(id);
console.log(`${todo.length} to fetch`);

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function fetchJSON(cidPath) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const gw = GATEWAYS[attempt % GATEWAYS.length];
    try {
      const r = await fetch(gw + cidPath, { signal: AbortSignal.timeout(20000) });
      if (r.ok) return await r.json();
    } catch {}
    await sleep(500 * (attempt + 1));
  }
  throw new Error('gave up on ' + cidPath);
}

async function one(id) {
  const uri = await client.readContract({ address: GENESIS, abi, functionName: 'tokenURI', args: [BigInt(id)] });
  const meta = await fetchJSON(uri.replace('ipfs://', ''));
  const t = {};
  for (const a of meta.attributes || []) t[a.trait_type] = a.value;
  db[id] = { img: meta.image.replace('ipfs://', ''), t };
}

let done = 0;
const queue = todo.slice();
await Promise.all(Array.from({ length: 6 }, async () => {
  while (queue.length) {
    const id = queue.shift();
    try { await one(id); } catch (e) { console.warn(id, e.message); }
    if (++done % 100 === 0) { fs.writeFileSync(OUT, JSON.stringify(db)); console.log(done); }
  }
}));
fs.writeFileSync(OUT, JSON.stringify(db));
console.log('cached', Object.keys(db).length);
