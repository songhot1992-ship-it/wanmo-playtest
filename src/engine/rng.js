// 可复现的随机数（mulberry32）。随机状态保存在 S.r 上，整个游戏状态因此是纯 JSON，
// 可以直接存档、克隆，并用于蒙特卡洛模拟。

export function rnd(S) {
  const a = (S.r = (S.r + 0x6d2b79f5) | 0);
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const chance = (S, p) => rnd(S) < p;
export const rint = (S, lo, hi) => lo + Math.floor(rnd(S) * (hi - lo + 1));
export const pick = (S, arr) => arr[Math.floor(rnd(S) * arr.length)];
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// 加权抽样：权重 ≤ 0 的项永远不会被抽中。
export function wpick(S, items, weightOf) {
  let total = 0;
  for (const it of items) total += Math.max(0, weightOf(it));
  if (total <= 0) return null;
  let x = rnd(S) * total;
  let last = null;
  for (const it of items) {
    const w = Math.max(0, weightOf(it));
    if (w <= 0) continue;
    last = it;
    x -= w;
    if (x < 0) return it;
  }
  return last;
}

export function seedFrom(text) {
  let h = 2166136261 >>> 0;
  for (const ch of String(text)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h | 0;
}
