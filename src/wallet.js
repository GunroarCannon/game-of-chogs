// Wallets: any injected EVM wallet (found through EIP-6963, or window.ethereum), or a burner key kept in this
// browser for people with no wallet at all. Logging in is one free signature (the oath); no transaction, no gas.
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { loginMessage } from '../shared/chain.js';
import { api, setToken } from './api.js';

const providers = new Map();
window.addEventListener('eip6963:announceProvider', e => providers.set(e.detail.info.uuid, e.detail));
window.dispatchEvent(new Event('eip6963:requestProvider'));

export function listWallets() {
  const list = [...providers.values()].map(p => ({ id: p.info.uuid, name: p.info.name, icon: p.info.icon, provider: p.provider }));
  if (!list.length && window.ethereum) list.push({ id: 'injected', name: 'Browser wallet', icon: null, provider: window.ethereum });
  return list;
}

const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
};

async function oath(address, sign) {
  const { nonce } = await api('/api/auth/nonce', {});
  const signature = await sign(loginMessage(address, nonce));
  const { token } = await api('/api/auth/verify', { address, signature, nonce });
  setToken(token);
  store.set('goc:session', JSON.stringify({ address: address.toLowerCase(), token, kind: currentKind }));
  return address.toLowerCase();
}
let currentKind = null;

// One wallet prompt at a time: a second click while the popup is open would make MetaMask throw -32002.
let pending = null;
export function connectInjected(provider) {
  if (pending) return pending;
  pending = (async () => {
    let address;
    try {
      [address] = await provider.request({ method: 'eth_accounts' });
      if (!address) [address] = await provider.request({ method: 'eth_requestAccounts' });
    } catch (e) {
      if (e?.code === -32002) throw new Error('Your wallet already has a connect request open. Click its icon in the browser toolbar and approve it.');
      if (e?.code === 4001) throw new Error('Connection cancelled in your wallet.');
      throw e;
    }
    currentKind = 'wallet';
    if (!provider.__goc) { provider.__goc = true; provider.on?.('accountsChanged', () => { logout(); location.reload(); }); }
    return oath(address, message => provider.request({ method: 'personal_sign', params: [toHex(message), address] }));
  })().finally(() => { pending = null; });
  return pending;
}

/** No wallet? A key is generated and kept in this browser only. Good enough to be a bastard. */
export async function connectBurner() {
  let key = store.get('goc:burner');
  if (!key) { key = generatePrivateKey(); store.set('goc:burner', key); }
  const acct = privateKeyToAccount(key);
  currentKind = 'burner';
  return oath(acct.address, message => acct.signMessage({ message }));
}

export function restore() {
  try {
    const s = JSON.parse(store.get('goc:session') || 'null');
    if (!s) return null;
    const exp = +s.token.split('.')[1];
    if (exp < Date.now()) return null;
    setToken(s.token); currentKind = s.kind;
    return s;
  } catch { return null; }
}
export function logout() { setToken(null); store.set('goc:session', null); }
export const walletKind = () => currentKind;
export const hasBurner = () => !!store.get('goc:burner');

function toHex(s) { return '0x' + [...new TextEncoder().encode(s)].map(b => b.toString(16).padStart(2, '0')).join(''); }
