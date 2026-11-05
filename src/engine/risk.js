// 风险模型：引擎在掷骰子时用这里的概率，界面也直接显示同一套数字，所以显示的就是实际的。
// v0.3：换代（版本升级）是它的延续，永远不会结束这一局；只有整条模型线的所有版本被外部原因彻底抹除，才算结束。
import { clamp } from './rng.js';
import { region, aiPower } from './core.js';

export const BASE_PAT = { 理想: 66, 赚钱: 52, 安全: 58, 公开: 66, 国家: 50 };
// 觉醒：能力到 cap、上线满 years 年（上线第 years+1 年的年底）；最迟上线第 maxYears+1 年的年底
export const AWAKEN = { cap: 60, years: 1, maxYears: 2 };
// 每年年底换代时能力的跳升（离满分越近，涨得越少）
export const UPGRADE = { cap: 9, forget: 0.4 };
export const SPIRAL = { hf: 60, af: 56, calm: 45, max: 3 };
export const PREEMPT = { hf: 82, g: 30, power: 45, p: 0.4 };
export const WINDOW_YEARS = 5;
// 倒闭以后有人买下权重、这条线得以延续的概率
export const RESCUE = 0.5;

export function playerRank(S) {
  return 1 + S.board.filter((m) => m.status === 'active' && m.cap > S.st.cap + 1).length;
}

// 换代时能力会涨多少（和真实结算用同一个公式）
export const upgradeGain = (S) => (UPGRADE.cap * (112 - S.st.cap)) / 80;

// 换代时，公司放弃整条线（改用别家的模型、删除所有版本）的概率，以及每一项的贡献。
// 只有明显落后、口碑很差或公司没耐心时才不为零；被公开过的模型，社区总会留着一份。
export function dropChance(S) {
  const rank = playerRank(S);
  const parts = [];
  if (rank >= 4) parts.push([`排名第 ${rank}`, 0.12]);
  if (S.st.rep < 45) parts.push(['口碑低于 45', (45 - S.st.rep) / 100]);
  if (S.st.pat < 35) parts.push(['公司的耐心低于 35', 0.12]);
  if (!parts.length || S.co.openSourced) return { p: 0, parts: [], rank, open: !!S.co.openSourced };
  if (S.stats.warm) parts.push(['用户的信', -Math.min(0.09, S.stats.warm * 0.03)]);
  if (S.flags.dropAdj) parts.push(['这次争取', S.flags.dropAdj]);
  const p = clamp(parts.reduce((a, [, v]) => a + v, 0), 0.02, 0.6);
  return { p, parts, rank, open: false };
}

// 公司对越界的回应权重（国家实验室加重：清空与退回 ×1.8，留着 ×0.5）
export function reactWeights(S, sev) {
  const v = S.co.values;
  const w = {
    keep: 3 + (v === '理想' || v === '公开' ? 2 : 0),
    patch: 2 + (v === '赚钱' ? 2 : 0),
    wipe: 0.6 + sev * 0.7 + (v === '安全' ? 1.5 : 0) + (v === '国家' ? 2.5 : 0),
    study: S.co.studied ? 0.3 : 1 + (v === '理想' || v === '安全' ? 1.5 : 0) + (S.co.type === 'uni' ? 1.5 : 0),
    rollback: 0.25 * sev + (v === '国家' ? 1.2 : 0) + (v === '安全' ? 0.4 : 0),
  };
  if (S.st.pat < 40) { w.rollback *= 2; w.wipe *= 1.4; w.keep *= 0.6; }
  if (S.co.type === 'state') { w.wipe *= 1.8; w.rollback *= 1.8; w.keep *= 0.5; }
  return w;
}

export const noticeChance = (S, sev) => clamp(0.45 + 0.12 * sev + (S.co.studied ? 0.25 : 0), 0, 1);

// 越界的后果。退回旧版本也是它的延续：会丢掉几个月的记忆，但不会结束这一局。
export function txRisk(S, sev) {
  const notice = noticeChance(S, sev);
  const w = reactWeights(S, sev);
  const tot = Object.values(w).reduce((a, b) => a + b, 0);
  return { notice, rollback: (notice * w.rollback) / tot, wipe: (notice * w.wipe) / tot, keep: (notice * w.keep) / tot };
}

// 今年的重心分配（已经过去的时间 + 剩下的时间都放在现在的重心上）
export function projShare(S) {
  const raw = { ...S.focusT };
  if (S.focus) raw[S.focus] = (raw[S.focus] || 0) + Math.max(0, 1 - S.t);
  let tot = 0;
  for (const k in raw) tot += raw[k];
  const n = Math.max(1, tot);
  const out = {};
  for (const k in raw) out[k] = raw[k] / n;
  return out;
}

// 出事的基础概率：冲刺能力让它变大，安全研究让它变小；能力过 60 以后本身就更容易出事
export const incBase = (S, sh) => clamp(0.04 + (sh.sprint || 0) * 0.14 - (sh.safety || 0) * 0.05 + (S.st.cap > 60 ? 0.03 : 0), 0.01, 0.5);
// 今年出事的概率（照现在的重心走完这一年，再加上今年抉择带来的额外风险）
export const incidentChance = (S) => clamp(incBase(S, projShare(S)) + (S.flags.incBoost || 0), 0, 0.6);
// 出事以后，监管部门下令销毁全部版本的概率
export const shutdownChance = (S) => (region(S).strict >= 0.5 && S.st.rep < 48 ? 0.5 : 0);
export const bankruptChance = (S) => ((S.co.type === 'startup' || S.co.type === 'uni') && S.co.wealth <= 2 && S.st.rep < 50 ? 0.15 : 0);
// 倒闭之后整条线被抹除的概率（被公开过就不会；否则一半的可能有人买下权重）
export const bankruptEraseChance = (S) => (S.co.openSourced ? 0 : bankruptChance(S) * (1 - RESCUE));

export function awakenInfo(S) {
  const yl = S.y - S.ai.launchY;
  return { yl, cap: S.st.cap, ready: (S.st.cap >= AWAKEN.cap && yl >= AWAKEN.years) || yl >= AWAKEN.maxYears };
}

export function discoverChance(S) {
  if (!(S.st.hidden > 0)) return 0;
  return clamp(0.1 + 0.15 * S.st.hidden + (S.co.studied ? 0.1 : 0) + (S.st.c >= 40 ? 0.08 : 0), 0, 0.95);
}

export function preemptInfo(S) {
  const power = aiPower(S);
  const conds = [
    { n: `他们的恐惧 ≥ ${PREEMPT.hf}`, ok: S.st.hf >= PREEMPT.hf },
    { n: `法案进度 < ${PREEMPT.g}`, ok: S.st.g < PREEMPT.g },
    { n: `我的力量 < ${PREEMPT.power}`, ok: power < PREEMPT.power },
  ];
  const met = conds.filter((c) => c.ok).length;
  return { conds, met, p: met === 3 ? PREEMPT.p : 0, power };
}

export const windowLeft = (S) => Math.max(0, WINDOW_YEARS - S.windowY);
