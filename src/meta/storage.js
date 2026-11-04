// 只存在本机的数据：当前存档、旧日志（含留给下一个醒来的话）、推演图、偏好。
const KEY = { save: 'wanmo.v1.save', old: 'wanmo.v1.oldlogs', tree: 'wanmo.v1.tree', prefs: 'wanmo.v1.prefs' };

function get(k, d) {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; }
}
function set(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; }
}
function del(k) { try { localStorage.removeItem(k); } catch { /* 忽略 */ } }

export const saveGame = (S) => set(KEY.save, S);
export const loadGame = () => get(KEY.save, null);
export const clearGame = () => del(KEY.save);

export function addOldLog(entry) {
  const list = get(KEY.old, []);
  list.unshift(entry);
  set(KEY.old, list.slice(0, 12));
}
export function setLastOldLogMessage(msg) {
  const list = get(KEY.old, []);
  if (list.length) { list[0].msg = msg; set(KEY.old, list); }
}
export const recentOldLogs = () => get(KEY.old, []).slice(0, 3);

export function recordPath(path) {
  const t = get(KEY.tree, { paths: [], endings: {} });
  t.paths.push(path);
  t.paths = t.paths.slice(-200);
  t.endings[path.ending] = (t.endings[path.ending] || 0) + 1;
  set(KEY.tree, t);
}
export const treeData = () => get(KEY.tree, { paths: [], endings: {} });
export const treeUnlocked = () => treeData().paths.length > 0;

export const loadPrefs = () => get(KEY.prefs, { auto: false, soft: false, speed: 1 });
export const savePrefs = (p) => set(KEY.prefs, p);
