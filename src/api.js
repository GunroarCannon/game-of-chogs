// Tiny fetch wrapper: JSON in, JSON out, the session token attached, errors thrown with the server's words.
let token = null;
export const setToken = t => { token = t; };
export const authed = () => !!token;

export async function api(path, body) {
  const r = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || `The raven got lost (${r.status}).`); e.status = r.status; throw e; }
  return j;
}
