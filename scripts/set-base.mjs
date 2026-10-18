// node scripts/set-base.mjs testnet|mainnet https://live-url  (points Bastard + Chogling tokenURIs at the live server)
import 'dotenv/config';
import fs from 'node:fs';
import { createPublicClient, createWalletClient, http, defineChain, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { MONAD, MONAD_TESTNET } from '../shared/chain.js';

const net = process.argv[2] === 'mainnet' ? 'mainnet' : 'testnet', url = process.argv[3].replace(/\/$/, '');
const N = net === 'mainnet' ? MONAD : MONAD_TESTNET;
const chain = defineChain({ id: N.id, name: N.name, nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 }, rpcUrls: { default: { http: [N.rpc] } } });
const account = privateKeyToAccount(process.env.RELAYER_KEY);
const pub = createPublicClient({ chain, transport: http() }), wal = createWalletClient({ chain, account, transport: http() });
const D = JSON.parse(fs.readFileSync('data/deployments.json', 'utf8'))[net];
const abi = parseAbi(['function setBase(string)']);
for (const [kind, addr] of [['bastard', D.bastards], ['heir', D.choglings]]) {
  await pub.waitForTransactionReceipt({ hash: await wal.writeContract({ address: addr, abi, functionName: 'setBase', args: [`${url}/meta/${kind}/`] }) });
  console.log(kind, '→', `${url}/meta/${kind}/`);
}
