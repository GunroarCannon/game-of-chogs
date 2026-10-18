// node scripts/deploy.mjs testnet|mainnet [publicUrl]
// Deploys ChogLedger and two ChogNobles (Bastards, Choglings). On testnet it also deploys a MockChogGenesis and
// mints five ids to each address in TEST_WALLETS (comma-separated), so the holder flow can be tested end to end.
import 'dotenv/config';
import fs from 'node:fs';
import { createPublicClient, createWalletClient, http, defineChain, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { GENESIS, MONAD, MONAD_TESTNET } from '../shared/chain.js';

const net = process.argv[2] === 'mainnet' ? 'mainnet' : 'testnet';
const url = (process.argv[3] || process.env.PUBLIC_URL || 'https://game-of-chogs.onrender.com').replace(/\/$/, '');
const N = net === 'mainnet' ? MONAD : MONAD_TESTNET;
const chain = defineChain({ id: N.id, name: N.name, nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 }, rpcUrls: { default: { http: [N.rpc] } } });
const account = privateKeyToAccount(process.env.RELAYER_KEY);
const pub = createPublicClient({ chain, transport: http() }), wal = createWalletClient({ chain, account, transport: http() });
console.log(net, 'deployer', account.address, formatEther(await pub.getBalance({ address: account.address })), 'MON');

const art = n => JSON.parse(fs.readFileSync(`contracts/out/${n}.json`, 'utf8'));
const send = async p => pub.waitForTransactionReceipt({ hash: await p });
async function deploy(name, args) {
  const { abi, bytecode } = art(name);
  const r = await send(wal.deployContract({ abi, bytecode, args }));
  console.log(name, r.contractAddress);
  return r.contractAddress;
}

const file = 'data/deployments.json';
const all = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
const out = all[net] || {};
const save = () => { all[net] = out; fs.writeFileSync(file, JSON.stringify(all, null, 2)); };
if (net === 'testnet' && !out.genesis) {
  out.genesis = await deploy('MockChogGenesis', []); save();
  const { abi } = art('MockChogGenesis');
  for (const [i, w] of (process.env.TEST_WALLETS || '').split(',').filter(Boolean).entries()) {
    const ids = [1, 2, 3, 4, 5].map(k => BigInt(i * 5 + k));
    await send(wal.writeContract({ address: out.genesis, abi, functionName: 'mint', args: [w, ids] }));
    console.log('minted mock Chogs', ids.join(','), 'to', w);
  }
}
const genesis = net === 'mainnet' ? GENESIS : out.genesis;
if (!out.ledger) { out.ledger = await deploy('ChogLedger', [account.address, genesis]); save(); }
if (!out.bastards) { out.bastards = await deploy('ChogNobles', ['Chog Snow', 'SNOW', `${url}/meta/bastard/`, account.address]); save(); }
if (!out.choglings) { out.choglings = await deploy('ChogNobles', ['Chogling', 'CHOGLING', `${url}/meta/heir/`, account.address]); save(); }
const { abi: L } = art('ChogLedger');
for (const [kind, a] of [[2, out.bastards], [3, out.choglings]]) await send(wal.writeContract({ address: out.ledger, abi: L, functionName: 'setCollection', args: [kind, a] }));
save();
console.log('saved', file, out);
