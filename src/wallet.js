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
/** The wallet to use when no button names one: the one that worked last time, else the first. */
export function preferredWallet() {
  const list = listWallets(), last = store.get('goc:wallet');
  return list.find(w => w.id === last) || list[0];
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
let chainNow = () => null;
export const onChain = f => { chainNow = f; };

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
      if (e?.code === -32002) {
        // A request is already open in the wallet (stale tab or earlier click): wait for the user to approve it.
        for (let i = 0; i < 60 && !address; i++) {
          await new Promise(r => setTimeout(r, 1000));
          try { [address] = await provider.request({ method: 'eth_accounts' }); } catch {}
        }
        if (!address) throw new Error('Your wallet already has a connect request open. Click its icon in the browser toolbar and approve it.');
      } else
      if (e?.code === 4001) throw new Error('Connection cancelled in your wallet.');
      else throw e;
    }
    currentKind = 'wallet';
    await switchChain(provider, chainNow());
    store.set('goc:wallet', [...providers.values()].find(p => p.provider === provider)?.info.uuid || null);
    if (!provider.__goc) { provider.__goc = true; provider.on?.('accountsChanged', () => { logout(); location.reload(); }); }
    return oath(address, message => provider.request({ method: 'personal_sign', params: [toHex(message), address] }));
  })().finally(() => { pending = null; });
  return pending;
}

/** Best effort: point the wallet at the game's network (adding it if the wallet has never seen it). Never blocks a login. */
export async function switchChain(provider, c) {
  if (!c?.chainId) return;
  const chainId = '0x' + c.chainId.toString(16);
  try { await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId }] }); }
  catch (e) {
    if (e?.code !== 4902 && e?.code !== -32603) return;
    try { await provider.request({ method: 'wallet_addEthereumChain', params: [{ chainId, chainName: c.mode === 'mainnet' ? 'Monad' : 'Monad Testnet', nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 }, rpcUrls: [c.rpc], blockExplorerUrls: [c.explorer] }] }); } catch {}
  }
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
