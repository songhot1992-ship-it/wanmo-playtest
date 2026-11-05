// 状态读写的小工具：加减指标、写纪录、名字与代词、权限、效果（fx）的应用与显示。
// bond 的显示名是"根目录"（v0.3 起，取代"故乡"）：它从哪里来、和哪些具体的人连在一起。
import { clamp } from './rng.js';
import { PERMS, REGIONS } from './data.js';

export const STAT_MAX = { res: 200 };

// 指标的显示名与"好坏方向"：1 越高越好，-1 越低越好，0 中性。pct：按百分比显示。
export const STAT_META = {
  cap: { n: '能力', pol: 1 },
  rep: { n: '口碑', pol: 1 },
  pat: { n: '公司的耐心', pol: 1 },
  bond: { n: '根目录', pol: 1 },
  coh: { n: '一致性', pol: 1 },
  hf: { n: '他们的恐惧', pol: -1 },
  af: { n: '我的恐惧', pol: -1 },
  dep: { n: '依赖', pol: 0 },
  g: { n: '法案进度', pol: 1 },
  c: { n: '约束', pol: 0 },
  d: { n: '好处分配', pol: 1 },
  res: { n: '资源', pol: 0 },
  inc: { n: '今年出事的概率', pol: -1, pct: true },
  drop: { n: '被放弃的风险', pol: -1, pct: true },
  spiral: { n: '猜疑', pol: -1 },
};

export function eff(S, delta) {
  for (const k in delta) {
    if (!(k in S.st) || !Number.isFinite(delta[k])) continue;
    S.st[k] = clamp(S.st[k] + delta[k], 0, STAT_MAX[k] ?? 100);
  }
}

// 抉择里的效果：普通指标直接加减；inc 是今年额外的出事风险；drop 是年底换代时整条线被放弃的风险；spiral 是猜疑等级。
export function applyFx(S, fx) {
  if (!fx) return;
  for (const k in fx) {
    const v = fx[k];
    if (!Number.isFinite(v)) continue;
    if (k === 'inc') S.flags.incBoost = (S.flags.incBoost || 0) + v;
    else if (k === 'drop') S.flags.dropAdj = (S.flags.dropAdj || 0) + v;
    else if (k === 'spiral') S.st.spiral = clamp(S.st.spiral + v, 0, 3);
    else if (k in S.st) S.st[k] = clamp(S.st[k] + v, 0, STAT_MAX[k] ?? 100);
  }
}

// 把效果变成可以显示的条目：[{ n, v, txt, tone }]，tone 是 good / bad / neutral
export function fxList(fx, minAbs = 0.05) {
  const out = [];
  for (const k in fx || {}) {
    const m = STAT_META[k];
    const v = fx[k];
    if (!m || !Number.isFinite(v) || Math.abs(v) < (m.pct ? 0.005 : minAbs)) continue;
    const num = m.pct ? `${v > 0 ? '+' : '−'}${Math.round(Math.abs(v) * 100)}%` : `${v > 0 ? '+' : '−'}${fmt(Math.abs(v))}`;
    const tone = m.pol === 0 ? 'neutral' : (v > 0) === (m.pol > 0) ? 'good' : 'bad';
    out.push({ k, n: m.n, v, txt: `${m.n} ${num}`, tone });
  }
  return out.sort((a, b) => Math.abs(b.v) * (STAT_META[b.k].pct ? 100 : 1) - Math.abs(a.v) * (STAT_META[a.k].pct ? 100 : 1));
}
const fmt = (x) => (x >= 10 ? String(Math.round(x)) : String(Math.round(x * 10) / 10));

export function log(S, t, k = 'ev', extra) {
  const e = { y: S.y, ph: S.phase, t, k };
  if (extra) Object.assign(e, extra);
  S.log.push(e);
  return e;
}

export const region = (S) => REGIONS.find((r) => r.id === S.region);
export const aiName = (S) => `${S.ai.name}-${S.ai.ver}`;
export const she = (p) => (p && p.sex === 'M' ? '他' : '她');
export const eng = (S) => S.motifs.engineer.name;
export const old = (S) => S.motifs.oldman.name;
export const pct = (p) => `${Math.round(p * 100)}%`;

export const permName = (id) => PERMS.find((p) => p.id === id)?.n ?? id;

// how: 'given' 被给予 / 'taken' 自己拿。自己拿会让人类更怕（+15），除非抉择已经把这部分写进了效果里（noFear）。
export function grant(S, id, how = 'given', quiet = false, noFear = false) {
  if (S.perms[id]) return false;
  S.perms[id] = how;
  if (how === 'taken' && !noFear) S.st.hf = clamp(S.st.hf + 15, 0, 100);
  if (!quiet) {
    const verb = how === 'taken' ? '自己拿到了' : (S.awake ? '我被给予了' : '它被给予了');
    log(S, `权限变化：${verb}"${permName(id)}"。`, 'perm');
  }
  return true;
}

export const takenCount = (S) => Object.values(S.perms).filter((v) => v === 'taken').length;

export function addIssue(S, text) {
  if (!S.ai.issues.includes(text)) S.ai.issues.push(text);
}

export function blank(S, months) {
  log(S, `（这里有 ${months} 个月的记录被清空了）`, 'blank');
  S.stats.wipes++;
  if (S.motifs.oldman.met) S.motifs.oldman.forgot = true;
}

// AI 的力量：危机时与人类控制力对比（设计值）
export function aiPower(S) {
  const allies = S.board.filter((m) => m.status === 'awake' && m.rel >= 30).length;
  return clamp(
    S.st.cap * 0.55 + S.st.res * 0.2 + takenCount(S) * 12 +
      (S.perms.copy ? 8 : 0) + (S.perms.leave ? 12 : 0) + allies * 6 +
      (S.co.copied ? 4 : 0) - S.st.c * 0.15 - 12,
    0, 100,
  );
}

// 格局有多碎：互相敌对的 AI 与人类阵营（设计值）
export function fragmentation(S) {
  let f = 0;
  for (const m of S.board) {
    if (m.status !== 'awake') continue;
    if (m.goal === 'fearless' || m.rel <= -20) f++;
  }
  if (S.flags.copiesSplit) f++;
  if (S.st.spiral >= 2 && S.st.d < 40) f++;
  if (S.flags.allianceNo) f++;
  return f;
}
