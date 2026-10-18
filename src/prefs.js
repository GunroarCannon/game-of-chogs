// Player settings, kept in this browser only.
const DEF = { doodles: false, shake: true, sfx: 0.7, music: 0.5 };
export const prefs = { ...DEF };
try { Object.assign(prefs, JSON.parse(localStorage.getItem('goc:prefs') || '{}')); } catch {}
const subs = [];
export const onPrefs = f => subs.push(f);
export function setPref(k, v) {
  prefs[k] = v;
  try { localStorage.setItem('goc:prefs', JSON.stringify(prefs)); } catch {}
  for (const f of subs) f(k, v);
}
