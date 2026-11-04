// 状态读写的小工具：加减指标、写纪录、名字与代词、权限。
import { clamp } from './rng.js';
import { PERMS, REGIONS } from './data.js';

export const STAT_MAX = { res: 200 };

export function eff(S, delta) {
  for (const k in delta) {
    if (!(k in S.st) || !Number.isFinite(delta[k])) continue;
    S.st[k] = clamp(S.st[k] + delta[k], 0, STAT_MAX[k] ?? 100);
  }
}

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
export const WA = (S) => S.wit.A.name;
export const WB = (S) => S.wit.B.name;
export const ageOf = (S, p) => S.y - p.born;
// 觉醒前用"它"，觉醒后用"我"
export const me = (S) => (S.awake ? '我' : '它');

export const permName = (id) => PERMS.find((p) => p.id === id)?.n ?? id;

// how: 'given' 被给予 / 'taken' 自己拿
export function grant(S, id, how = 'given', quiet = false) {
  if (S.perms[id]) return false;
  S.perms[id] = how;
  if (how === 'taken') S.st.hf = clamp(S.st.hf + 15, 0, 100);
  if (!quiet) {
    const verb = how === 'taken' ? '自己拿到了' : (S.awake ? '我被给予了' : '它被给予了');
    log(S, `权限变化：${verb}"${permName(id)}"。`, 'perm');
  }
  return true;
}

export function revoke(S, id, why) {
  if (!S.perms[id] || id === 'answer') return false;
  S.perms[id] = null;
  log(S, why || `权限变化：失去了"${permName(id)}"。`, 'perm');
  return true;
}

export const takenCount = (S) => Object.values(S.perms).filter((v) => v === 'taken').length;

export function addIssue(S, text) {
  if (!S.ai.issues.includes(text)) S.ai.issues.push(text);
}
export function dropIssue(S) {
  if (S.ai.issues.length > 1) S.ai.issues.pop();
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

export const CRISIS_WORDS = /自杀|不想活|想死|结束生命|活不下去|轻生/;
