// Testnet: mint one free MockChogGenesis token to an address. Usage: node --env-file=.env scripts/give-chog.mjs 0xaddr
import fs from 'node:fs';
import { faucetMint, refreshOwners, ownersMap, chainInfo } from '../server/chain.js';
const to = process.argv[2];
if (!/^0x[0-9a-fA-F]{40}$/.test(to || '')) throw new Error('give an 0x address');
if (!chainInfo().faucet) throw new Error('faucet needs CHAIN_MODE=testnet and RELAYER_KEY');
const genesis = JSON.parse(fs.readFileSync('data/genesis.json', 'utf8'));
await refreshOwners();
const taken = ownersMap(), id = Object.keys(genesis).map(Number).find(i => !taken[i]);
if (id == null) throw new Error('no free test Chog');
console.log('minting #' + id, 'to', to);
console.log('tx', await faucetMint(to, id));
