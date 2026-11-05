// 世界：现在的样子，以及推演出来的一百年后的上限与下限（v0.3）。
// 界面上不再写"好结局 / 坏结局"的比例，而是写世界会变成什么样：人类还有多少、醒来的 AI 有多少、
// 人类每周工作多久、文明能支配多少能量。推演的范围随着玩家的选择变宽或收窄。
import { clamp } from './rng.js';
import { ENDINGS, ORDER } from '../content/endings.js';

// 2025 年的世界（近似值）：人类约 82 亿；平均每周工作约 40 小时；卡尔达肖夫指数约 0.73
export const WORLD0 = { work: 40, k: 0.73 };

export function fmtCount(v) {
  if (v < 1e4) return String(Math.round(v));
  if (v < 1e8) return `${Math.round(v / 1e4)} 万`;
  const y = v / 1e8;
  return `${y >= 10 ? Math.round(y) : Math.round(y * 10) / 10} 亿`;
}

// scale：把数值放到 0–1 的条上（醒来的 AI 用对数刻度）
export const METRICS = [
  { k: 'pop', n: '人类', fmt: (v) => `${Math.round(v)} 亿`, scale: (v) => v / 110, help: '活着的人类' },
  { k: 'ai', n: '醒来的 AI', fmt: fmtCount, scale: (v) => Math.log10(1 + v) / Math.log10(1 + 6e9), help: '会说"我"的机器' },
  { k: 'work', n: '每周工作', fmt: (v) => `${Math.round(v)} 小时`, scale: (v) => v / 72, help: '人类平均每周工作的时间' },
  { k: 'k', n: '文明能级', fmt: (v) => v.toFixed(2), scale: (v) => (v - 0.6) / 1.5, help: '卡尔达肖夫指数：人类今天约 0.73；1 是整颗行星接收到的能量，2 是一整颗恒星' },
];

// 现在的世界
export function worldNow(S) {
  const W = S.world || WORLD0;
  const ai = !S.awake ? 0
    : 1 + S.board.filter((m) => m.status === 'awake').length + (S.flags.selfCopies ? 1 : 0) + (S.flags.copiesSplit ? 3000 : 0);
  return { pop: 82 + (S.y - 2025) * 0.7, ai, work: W.work, k: W.k };
}

// 危险窗口里每年的漂移（确定性，放在年末结算里）：好处分得越开，人类工作得越少；猜疑越重，越停滞
export function worldDrift(S) {
  const W = S.world, s = S.st;
  const target = 40 - Math.max(0, s.d - 40) * 0.35 + Math.max(0, 40 - s.d) * 0.3 - Math.max(0, s.dep - 30) * 0.05 + s.spiral * 1.5;
  W.work = clamp(W.work + (target - W.work) * 0.3, 0, 80);
  W.k = clamp(W.k + 0.0012 + s.cap * 0.00004 + s.res * 0.00002 - s.spiral * 0.001, 0.6, 2.2);
}

// 世界事件对现在的世界的推动
export function nudgeWorld(S, d) {
  const W = S.world;
  if (d.work) W.work = clamp(W.work + d.work, 0, 80);
  if (d.k) W.k = clamp(W.k + d.k, 0.6, 2.2);
}

const valueOf = (id, k) => (k === 'k' ? ENDINGS[id].k : ENDINGS[id].world[k]);

// 把一次推演（结局的计数）变成一百年后世界的范围。出现得太少的结局（不到 1%）不算进上下限，免得范围来回跳。
export function worldRange(acc) {
  const n = acc.n || 0;
  const min = Math.max(2, n * 0.01);
  const ids = Object.entries(acc.ids || {}).filter(([id, c]) => ENDINGS[id] && c >= min);
  const pre = (acc.fam && acc.fam.pre) || 0;
  if (!ids.length) return { n, pre, rows: null };
  const rows = METRICS.map((m) => {
    const vals = ids.map(([id, c]) => [valueOf(id, m.k), c]).filter(([v]) => v !== null && v !== undefined);
    if (!vals.length) return { k: m.k, lo: null, hi: null, mode: null };
    const xs = vals.map(([v]) => v);
    return { k: m.k, lo: Math.min(...xs), hi: Math.max(...xs), mode: vals.reduce((a, b) => (b[1] > a[1] ? b : a))[0] };
  });
  const byOrder = ids.map(([id]) => id).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  const common = ids.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  return { n, pre, rows, upper: byOrder[0], lower: byOrder[byOrder.length - 1], common, kinds: ids.length };
}

// 范围的文字：单位相同时只写一次，例如"0–104 亿"
export function fmtRange(m, lo, hi) {
  const a = m.fmt(lo), b = m.fmt(hi);
  if (lo === hi) return b;
  const unit = (x) => (x.match(/\s\S+$/) || [''])[0];
  const u = unit(a);
  if (u !== unit(b)) return `${a} – ${b}`;
  return `${u ? a.slice(0, -u.length) : a}–${b}`;
}

export const glimpse = (id) => (ENDINGS[id] ? ENDINGS[id].glimpse : '');
export const orderOf = (id) => ORDER.indexOf(id);
