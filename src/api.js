// Tiny fetch wrapper: JSON in, JSON out, the session token attached, errors thrown with the server's words.
let token = null;
export const setToken = t => { token = t; };
// Which Monad network the player is on; the server reads it from X-Net. Unset means the server's default.
export const getNet = () => { try { return localStorage.getItem('goc:net'); } catch { return null; } };
export const setNet = n => { try { n ? localStorage.setItem('goc:net', n) : localStorage.removeItem('goc:net'); } catch {} };
export const authed = () => !!token;

export async function api(path, body) {
  const r = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: { ...(getNet() ? { 'X-Net': getNet() } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || `The raven got lost (${r.status}).`); e.status = r.status; throw e; }
  return j;
}
