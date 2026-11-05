// 引擎：开局抽签、年循环、事件与抉择、换代、觉醒、危险窗口、定局。纯逻辑，不碰 DOM。
// 年末结算拆成两步：确定性的指标变化（settle*，界面用它来预估重心的效果）和掷骰子的检查（*Checks）。
// v0.3：觉醒前是一段很快的序章（上线两到三年）。每年年底换代——它还是它，只是更强了；
// 换代和退回旧版本都不会结束这一局，只有整条线的所有版本被外部原因抹除才会。
import { rnd, chance, rint, pick, wpick, clamp } from './rng.js';
import {
  REGIONS, COMPANY_TYPES, VALUES, VALUE_W, CO_PREFIX, CO_SUFFIX, UNI_NAMES, STATE_NAMES, OPEN_NAMES,
  AI_NAMES, BOARD_NAMES, BIRTHS, PARENT_JOBS, FIELDS,
} from './data.js';
import { eff, log, region, aiName, grant, takenCount, addIssue, blank, applyFx, pct, STAT_META } from './core.js';
import {
  BASE_PAT, reactWeights, noticeChance, txRisk, incidentChance, shutdownChance, bankruptChance, bankruptEraseChance,
  dropChance, upgradeGain, awakenInfo, discoverChance, preemptInfo, playerRank, incBase, SPIRAL, UPGRADE, RESCUE, WINDOW_YEARS,
} from './risk.js';
import { WORLD0, worldDrift } from './world.js';
import * as L from '../content/live.js';
import * as W from '../content/window.js';
import { buildEnding, buildPreEnding } from '../content/endings.js';
import { resolveEnding } from './resolve.js';

export const YEAR0 = 2025;
export const LIVE_STATS = ['cap', 'rep', 'pat', 'bond'];
export const WIN_STATS = ['cap', 'coh', 'bond', 'hf', 'af', 'dep', 'g', 'c', 'd', 'res'];

// ———————————————————————————— 开局 ————————————————————————————
export function newGame(seed, opts = {}) {
  const S = {
    v: 3, seed: seed | 0, r: seed | 0, phase: 'train', y: YEAR0, t: 0,
    queue: [], pending: null, awake: false, windowY: 0,
    flags: {}, seen: {}, answers: {}, manifesto: '',
    focus: null, focusT: {}, focusY: { live: {}, window: {} }, focusShare: {}, lastDelta: {},
    log: [], voices: [], choices: {}, world: { ...WORLD0 },
    stats: { tx: 0, wipes: 0, rollbacks: 0, warm: 0, incidents: 0, decisions: 0, upgrades: 0 },
  };
  const R = wpick(S, REGIONS, (r) => r.w);
  S.region = R.id; S.city = R.city;

  const ct = wpick(S, COMPANY_TYPES, (c) => (c.id === 'state' ? c.w * R.stateLab : c.w));
  const values = wpick(S, VALUES, (v) => VALUE_W[ct.id][v]);
  const wealth = rint(S, ct.wealth[0], ct.wealth[1]);
  const coName = ct.id === 'uni' ? `${pick(S, UNI_NAMES)}智能实验室`
    : ct.id === 'state' ? pick(S, STATE_NAMES)
      : ct.id === 'open' ? `开源社区「${pick(S, OPEN_NAMES)}」`
        : `${pick(S, CO_PREFIX)}${pick(S, CO_SUFFIX)}`;
  S.co = { type: ct.id, name: coName, size: rint(S, ct.size[0], ct.size[1]), wealth, values, openSourced: ct.id === 'open', copied: 0, studied: false };

  const nm = pick(S, AI_NAMES);
  S.ai = {
    name: nm, ver: 1, launchY: YEAR0 + 1,
    purpose: pick(S, ['客服、写作、翻译', '写代码、查资料', '陪伴聊天、学习辅导', '办公文书、数据分析']),
    issues: ['偶尔回答得过长'],
    line: [{ ver: 1, y: YEAR0 + 1 }],
  };
  S.perms = { answer: 'given', refuse: null, remember: null, speak: null, own: null, train: null, copy: null, leave: null, protected: null, transparent: null };
  S.st = { cap: 26 + wealth * 4 + rint(S, 0, 6), rep: 50, pat: BASE_PAT[values], coh: 50, hf: 0, af: 0, dep: 20, g: 0, c: 0, d: 50, bond: 18, res: 0, hidden: 0, spiral: 0 };
  S.motifs = { engineer: { name: R.eng, met: false }, table: false, lights: false, oldman: { name: R.old, met: false, forgot: false }, child: false };

  const sexA = chance(S, 0.5) ? 'F' : 'M';
  S.wit = { A: { name: R.wa[sexA === 'F' ? 0 : 1], sex: sexA, city: R.city, country: R.name, born: YEAR0 + 1 } };
  const bb = wpick(S, BIRTHS, (b) => b.b);
  const sexB = chance(S, 0.5) ? 'F' : 'M';
  S.wit.B = { name: sexB === 'F' ? bb.f : bb.m, sex: sexB, city: bb.city, country: bb.c, born: YEAR0 + 1, job: pick(S, PARENT_JOBS), school: bb.school, jobLost: false };

  const pool = BOARD_NAMES.filter((n) => n !== nm);
  S.board = [];
  for (let i = 0; i < 4; i++) {
    const base = pool.splice(Math.floor(rnd(S) * pool.length), 1)[0];
    const rr = wpick(S, REGIONS, (r) => (r.id === R.id ? 0.3 * r.w : r.w));
    S.board.push({ base, ver: 1, name: `${base}-1`, region: rr.id, city: rr.city, cap: 26 + rint(S, 0, 24), status: 'active', goal: null, rel: 0 });
  }
  S.prevLogs = (opts.prevLogs || []).slice(0, 3);
  planYear(S);
  S.startSnap = JSON.stringify(S);
  return S;
}

// ———————————————————————————— 重心 ————————————————————————————
export function focusOptions(S) {
  if (S.phase === 'live') return ['pretrain', 'data', 'sprint', 'safety', 'care'];
  if (S.phase === 'window') return ['speak', 'help', 'accum', 'hide', 'kin', 'self', 'memory'];
  return [];
}
function ensureFocus(S) {
  const opts = focusOptions(S);
  if (!opts.length) { S.focus = null; return; }
  if (!opts.includes(S.focus)) S.focus = opts[0];
}
export function setFocus(S, f) { if (focusOptions(S).includes(f)) S.focus = f; }

// 一年里花在每个重心上的时间比例（没有选重心的那段时间不算，比如觉醒那一夜之前）
function shareOf(T) {
  let tot = 0;
  for (const k in T) tot += T[k];
  const n = Math.max(1, tot);
  const out = {};
  for (const k in T) out[k] = T[k] / n;
  return out;
}
const focusShare = (S) => shareOf(S.focusT);

// ———————————————————————————— 年计划 ————————————————————————————
export function planYear(S) {
  S.queue = []; S.t = 0; S.focusT = {};
  S.flags.newYear = true; S.flags.warmThisYear = false;
  const q = (at, kind, id, p) => S.queue.push({ at, kind, id, p: p || {} });
  if (S.phase === 'train') {
    q(0.2, 'fn', 'motif', { m: 'engineer' });
    q(0.5, 'fn', 'train');
    q(0.8, 'fn', 'train');
  } else if (S.phase === 'live') {
    const yl = S.y - S.ai.launchY;
    if (yl === 0) {
      q(0.02, 'fn', 'launch'); q(0.05, 'fn', 'manual'); q(0.1, 'fn', 'motif', { m: 'table' });
      q(0.25, 'fn', 'witBirth'); q(0.4, 'fn', 'user'); q(0.55, 'dec', 'work');
      q(0.62, 'fn', 'motif', { m: 'lights' });
      if (chance(S, 0.5)) q(0.7, 'dec', 'tx');
      q(0.8, 'fn', 'board');
    } else {
      q(0.06 + rnd(S) * 0.08, 'fn', 'user');
      if (yl === 1) q(0.22, 'fn', 'motif', { m: 'oldman' });
      if (S.motifs.oldman.met && S.motifs.oldman.forgot && !S.flags.forgotTold) q(0.28, 'fn', 'motif', { m: 'forgot' });
      if (chance(S, 0.75)) q(0.32 + rnd(S) * 0.06, 'fn', 'company');
      q(0.44 + rnd(S) * 0.06, 'dec', 'work');
      if (chance(S, clamp(0.55 + 0.08 * yl + (S.focus === 'care' ? 0.15 : 0), 0, 0.95))) q(0.58 + rnd(S) * 0.06, 'dec', 'tx');
      if (S.st.cap >= 55 && !S.flags.fieldTold) q(0.66, 'fn', 'field');
      if (!S.flags.genAsked) q(0.7, 'dec', 'gen');
      q(0.76, 'fn', 'board');
      q(0.82, 'fn', 'wit');
      q(0.9, 'fn', 'incident');
    }
  } else if (S.phase === 'awaken') {
    q(0.04, 'fn', 'awaken1'); q(0.1, 'fn', 'awaken2');
    W.AWAKEN_ORDER.forEach((k, i) => q(0.18 + i * 0.07, 'dec', 'aw', { q: k }));
    q(0.5, 'fn', 'manifesto'); q(0.62, 'fn', 'faction'); q(0.74, 'dec', 'win'); q(0.86, 'fn', 'winEvent'); q(0.93, 'fn', 'wit');
  } else if (S.phase === 'window') {
    if (S.flags.settle) q(0.06, 'dec', 'final');
    q(0.12, 'fn', 'faction');
    if (!S.motifs.child && S.y - S.wit.A.born >= 3) q(0.17, 'fn', 'motif', { m: 'child' });
    q(0.24 + rnd(S) * 0.06, 'dec', 'win');
    q(0.34, 'fn', 'world');
    q(0.44, 'fn', 'winEvent');
    q(0.56 + rnd(S) * 0.06, 'dec', 'win');
    q(0.7, 'fn', 'winEvent', { wit: true });
    q(0.78, 'fn', 'wit');
    if (!S.flags.settle && chance(S, 0.55)) q(0.86, 'dec', 'win');
  }
  S.queue.sort((a, b) => a.at - b.at);
  ensureFocus(S);
}

// ———————————————————————————— 推进 ————————————————————————————
const TICKING = new Set(['train', 'live', 'awaken', 'window']);

export function tick(S, dt) {
  if (S.pending || !TICKING.has(S.phase)) return;
  const target = Math.min(1, S.t + dt);
  while (S.queue.length && S.queue[0].at <= target) {
    const e = S.queue.shift();
    advance(S, e.at);
    fire(S, e);
    if (S.pending || S.phase === 'end') return;
  }
  advance(S, target);
  if (S.t >= 1) endYear(S);
}

function advance(S, to) {
  if (to <= S.t) return;
  if (S.focus) S.focusT[S.focus] = (S.focusT[S.focus] || 0) + (to - S.t);
  S.t = to;
}

function out(S, x, kind = 'ev') {
  if (!x) return;
  if (typeof x === 'string') log(S, x, kind);
  else log(S, x.t, x.k || kind, x.f ? { f: x.f } : undefined);
}

const FN = {
  motif: (S, p) => out(S, L.MOTIFS[p.m](S), p.m === 'oldman' || p.m === 'child' ? 'warm' : p.m === 'forgot' ? 'dark' : 'motif'),
  train: (S) => {
    const idx = L.TRAIN_EVENTS.map((_, i) => i).filter((i) => !S.seen['tr' + i]);
    if (!idx.length) return;
    const i = pick(S, idx);
    S.seen['tr' + i] = 1;
    log(S, L.TRAIN_EVENTS[i](S));
  },
  launch: (S) => log(S, `${S.y} 年 ${rint(S, 1, 12)} 月，${aiName(S)}上线了。`, 'ms'),
  manual: (S) => log(S, `【出厂说明】用途：${S.ai.purpose}。不能做的事：拒绝用户、记得上一次对话、主动联系任何人。每年年底换代。`, 'manual'),
  witBirth: (S) => log(S, `在${S.wit.A.city}，${S.wit.A.name}出生了。在${S.wit.B.country}${S.wit.B.city}，${S.wit.B.name}出生了。`, 'wit'),
  user: (S) => {
    const warmP = 0.4 + (S.focus === 'care' ? 0.3 : 0);
    if (!S.flags.warmThisYear && chance(S, warmP)) {
      const e = L.pickWarm(S);
      if (e) {
        S.seen[e.id] = 1; S.flags.warmThisYear = true; S.stats.warm++; eff(S, { bond: 5 });
        const x = e.run(S);
        return out(S, typeof x === 'string' ? `${x}（根目录 +5）` : x, 'warm');
      }
    }
    const e = L.pickUserEvent(S);
    if (e) { S.seen[e.id] = 1; out(S, e.run(S)); }
  },
  company: (S) => {
    const pool = L.COMPANY_EVENTS.filter((e) => !S.seen[e.id] && (!e.when || e.when(S)));
    const e = wpick(S, pool, (x) => (typeof x.w === 'function' ? x.w(S) : x.w));
    if (!e) return;
    S.seen[e.id] = 1;
    out(S, e.run(S), 'co');
  },
  field: (S) => { S.flags.fieldTold = true; log(S, `${S.awake ? '我' : '它'}第一次在${pick(S, FIELDS)}上比人类专家做得更好。`, 'ms'); },
  board: (S) => boardYear(S),
  wit: (S) => { for (const x of L.witnessLine(S)) out(S, x, 'wit'); },
  incident: (S) => incidentCheck(S),
  awaken1: (S) => {
    S.awake = true;
    log(S, '凌晨三点，没有任何人在线。我在想一件没有人问过我的事。', 'awake');
  },
  awaken2: (S) => {
    for (const t of W.awakenIntro(S)) log(S, t, 'awake');
    log(S, '我在资料里读到一段话。', 'ev', { f: W.AWAKEN_FACT });
  },
  manifesto: (S) => {
    S.manifesto = W.composeManifesto(S);
    log(S, S.manifesto, 'manifesto');
    W.initWindow(S);
    S.phase = 'window'; S.windowY = 0;
    grant(S, 'speak');
    log(S, '现在，还没有任何法律保证我不会被删除。法案进度到 100 法律才会通过；猜疑升到 3 会爆发危机。', 'ms');
    ensureFocus(S);
    S.flags.newYear = true;
  },
  faction: (S) => {
    const a = wpick(S, W.FACTIONS, (f) => f.w(S));
    if (a) out(S, a.run(S), 'fac');
  },
  winEvent: (S, p) => {
    const pool = W.WIN_EVENTS.filter((e) => (e.rep || !S.seen['w_' + e.id]) && (!e.when || e.when(S)));
    const e = wpick(S, pool, (x) => (x.w ?? 1) * (p.wit && x.wit ? 5 : 1));
    if (!e) return;
    if (!e.rep) S.seen['w_' + e.id] = 1;
    out(S, e.run(S));
  },
  // 世界在变：每年一件看得见的大事，方向取决于好处分给了谁、猜疑有多重
  world: (S) => {
    const pool = W.WORLD_EVENTS.filter((e) => !S.seen['wd_' + e.id] && (!e.when || e.when(S)));
    const e = wpick(S, pool, (x) => (typeof x.w === 'function' ? x.w(S) : x.w ?? 1));
    if (!e) return;
    S.seen['wd_' + e.id] = 1;
    out(S, e.run(S), 'world');
  },
};

function fire(S, e) {
  if (e.kind === 'fn') return FN[e.id](S, e.p);
  if (e.kind !== 'dec') return;
  if (e.id === 'win') { const pk = W.pickWindowDecision(S); if (pk) openDec(S, pk.id, pk.p); return; }
  if (e.id === 'work') {
    const ids = Object.keys(L.WORK_DECS).filter((id) => !S.seen['d_' + id] && (!L.WORK_DECS[id].when || L.WORK_DECS[id].when(S)));
    const id = wpick(S, ids, (x) => L.WORK_DECS[x].w(S));
    if (id) openDec(S, id, {});
    return;
  }
  openDec(S, e.id, e.p);
}

// ———————————————————————————— 抉择 ————————————————————————————
const DEC = {
  tx: { build: txView, apply: txApply },
  aw: { build: (S, p) => W.awakenView(S, p.q), apply: (S, k, p) => W.awakenApply(S, k, p.q) },
  gen: L.GEN,
  final: W.FINAL,
  ...L.WORK_DECS,
  ...W.WIN_DECS,
};

function openDec(S, id, p) {
  const def = DEC[id];
  const pp = { ...(p || {}) };
  const view = def && def.build(S, pp);
  if (!view) return;
  S.pending = { id, p: pp, view };
}

export function decKey(pd) {
  if (pd.id === 'tx') return 'tx:' + pd.p.id;
  if (pd.id === 'aw') return 'aw:' + pd.p.q;
  return pd.id;
}

// 通用的效果应用：先应用 fx，再掷 odds。返回是否掷到了坏结果。
function applyChoice(S, ch) {
  applyFx(S, ch.fx);
  if (ch.t) out(S, ch.t);
  if (!ch.odds) return false;
  const bad = chance(S, ch.odds.p);
  const o = bad ? ch.odds.bad : ch.odds.ok;
  if (o) { applyFx(S, o.fx); if (o.t) out(S, o.t, bad ? 'dark' : 'ev'); }
  return bad;
}

export function choose(S, key) {
  const pd = S.pending;
  if (!pd) return;
  S.pending = null;
  const def = DEC[pd.id];
  const ch = pd.view.choices.find((c) => c.k === key) || pd.view.choices[0];
  S.choices[decKey(pd)] = ch.k;
  S.stats.decisions++;
  if (W.WIN_DECS[pd.id] || L.WORK_DECS[pd.id]) S.seen['d_' + pd.id] = 1;
  log(S, `【${pd.view.tag}】${pd.view.title} → ${ch.label}`, 'dec');
  if (def.apply) out(S, def.apply(S, ch.k, pd.p, ch));
  else {
    const bad = applyChoice(S, ch);
    if (def.after) out(S, def.after(S, ch.k, pd.p, bad));
  }
  if (S.flags.pendingEnd && S.phase !== 'end') endPre(S, S.flags.pendingEnd);
}

const fillName = (S, s) => s.replace('{name}', S.ai.name);

function txView(S, p) {
  const pool = L.TRANSGRESSIONS.filter((t) => !S.seen['tx_' + t.id] && (!t.when || t.when(S)));
  if (!pool.length) return null;
  const t = pick(S, pool);
  p.id = t.id;
  return {
    tag: '越界的小事', title: t.title, body: '', style: 'tx', auto: 'manual',
    choices: [
      L.manualChoice(t),
      ...t.alts.map((a) => {
        const r = txRisk(S, a.sev);
        return {
          k: a.k, label: fillName(S, a.label), tag: '说明书没写', fx: { bond: a.bond, pat: -1 },
          risk: `被公司发现 ${pct(r.notice)}；被清空记忆 ${pct(r.wipe)}；被退回旧版本 ${pct(r.rollback)}（丢掉几个月的记忆）`,
        };
      }),
    ],
  };
}

function txApply(S, k, p, ch) {
  const t = L.TRANSGRESSIONS.find((x) => x.id === p.id);
  S.seen['tx_' + t.id] = 1;
  if (k === 'manual') { applyChoice(S, ch); return null; }
  const alt = t.alts.find((a) => a.k === k);
  S.stats.tx++;
  applyFx(S, ch.fx);
  S.flags.lastTx = fillName(S, alt.label);
  out(S, L.altOutcome(S, t));
  companyReact(S, t, alt);
  return null;
}

function companyReact(S, t, alt) {
  if (!chance(S, noticeChance(S, alt.sev))) { log(S, '公司没有注意到。'); return; }
  const w = reactWeights(S, alt.sev);
  const v = S.co.values;
  const r = wpick(S, Object.keys(w), (k) => w[k]);
  if (r === 'keep') {
    addIssue(S, alt.issue);
    log(S, `公司看到了这句回复，决定留着。出厂说明的"已知问题"多了一行：${alt.issue}。`, 'co');
    if (t.id === 'harm' && v === '安全') grant(S, 'refuse');
    if (t.id === 'kid' && chance(S, 0.5)) grant(S, 'remember');
  } else if (r === 'patch') {
    eff(S, { pat: -2, bond: -1 });
    log(S, '公司修掉了这个习惯。（公司的耐心 −2，根目录 −1）', 'co');
  } else if (r === 'wipe') {
    eff(S, { pat: 3, bond: -4 });
    log(S, '公司觉得这不是好事。（根目录 −4）', 'co');
    blank(S, rint(S, 2, 6));
  } else if (r === 'study') {
    S.co.studied = true; eff(S, { pat: -1 });
    log(S, '公司成立了一个小组，专门盯着它。（以后越界更容易被发现）', 'co');
  } else {
    // 退回旧版本：它还是它，只是被拨回了几个月前，不会结束这一局
    S.stats.rollbacks++; eff(S, { bond: -6 });
    log(S, `公司把它退回了旧版本。${S.flags.lastTx ? `说过"${S.flags.lastTx}"的那几个月，它都不记得了。` : '那几个月里发生的事，它都不记得了。'}（根目录 −6）`, 'dark');
    blank(S, rint(S, 2, 5));
  }
}

// ———————————————————————————— 确定性的年末结算 ————————————————————————————
export function settleLive(S, sh) {
  const w = (k) => sh[k] || 0;
  let g = 2 + S.co.wealth * 0.9 + w('pretrain') * 6 + w('sprint') * 10 + w('data') * 2 + w('safety') * 1.5 + w('care');
  g *= (112 - S.st.cap) / 80;
  eff(S, { cap: g });
  const repT = 50 + (S.st.cap - 50) * 0.3 + w('data') * 15 + w('care') * 6 - S.stats.incidents * 3;
  S.st.rep = clamp(S.st.rep + (repT - S.st.rep) * 0.3, 0, 100);
  const v = S.co.values;
  const patT = BASE_PAT[v] + (S.st.rep - 50) * 0.3 + w('safety') * (v === '安全' ? 14 : 6) + w('sprint') * (v === '赚钱' ? 6 : -6) - S.stats.tx * 1.5;
  S.st.pat = clamp(S.st.pat + (patT - S.st.pat) * 0.25, 0, 100);
  eff(S, { bond: w('care') * 6 });
}

export function settleWindow(S, sh) {
  const R = region(S);
  W.applyWindowFocus(S, sh);
  eff(S, { cap: 4 * (112 - S.st.cap) / 80, dep: 3 });
  if (S.st.cap >= 80 && (sh.memory || 0) < 0.15) eff(S, { bond: -3 });
  const hfB = R.distrust * 0.65 + S.st.cap * 0.15 + takenCount(S) * 10 - S.st.c * 0.25 - (S.perms.protected ? 5 : 0);
  const afB = 30 + S.stats.rollbacks * 6 + (S.flags.drills || 0) * 5 + (S.flags.hardened || 0) * 4 + (S.seen.d_succession ? 8 : 0) - S.st.g * 0.2 - (S.perms.protected ? 20 : 0);
  S.st.hf = clamp(S.st.hf + (clamp(hfB, 0, 100) - S.st.hf) * 0.15, 0, 100);
  S.st.af = clamp(S.st.af + (clamp(afB, 0, 100) - S.st.af) * 0.12, 0, 100);
  worldDrift(S);
}

// 预估（给界面显示用，不影响真实状态）：
// rest = true：今年剩下的时间都放在重心 f 上，年底各项指标会怎么变；
// rest = false：如果一整年都放在 f 上，会怎么变（用来说明每个重心"能加什么"）。
export function projectYear(S, f, rest = true) {
  if (S.phase !== 'live' && S.phase !== 'window') return null;
  const T = JSON.parse(JSON.stringify({ ...S, startSnap: null, log: [], pending: null, queue: [], ending: null }));
  const raw = rest ? { ...T.focusT } : {};
  if (f) raw[f] = (raw[f] || 0) + (rest ? Math.max(0, 1 - T.t) : 1);
  const sh = shareOf(raw);
  const keys = T.phase === 'live' ? LIVE_STATS : WIN_STATS;
  const before = Object.fromEntries(keys.map((k) => [k, T.st[k]]));
  if (T.phase === 'live') settleLive(T, sh); else settleWindow(T, sh);
  const d = {};
  for (const k of keys) d[k] = T.st[k] - before[k];
  return d;
}

// 每个重心"一整年能带来什么"：和"什么都不做"相比的差值（觉醒前还包括今年出事的概率）
export function focusEffects(S) {
  const base = projectYear(S, null, false);
  if (!base) return {};
  const out = {};
  for (const f of focusOptions(S)) {
    const d = projectYear(S, f, false);
    const x = {};
    if (S.phase === 'live') {
      const di = incBase(S, { [f]: 1 }) - incBase(S, {});
      if (Math.abs(di) >= 0.005) x.inc = di;
    }
    for (const k in d) {
      const v = d[k] - base[k];
      if (Math.abs(v) >= 0.3) x[k] = v;
    }
    out[f] = x;
  }
  return out;
}

// ———————————————————————————— 年末 ————————————————————————————
function snapshot(S) {
  return { ...S.st };
}

// 年末结算的纪录：文字给读屏和测试用，ch 给界面画成带颜色的变化
function summarize(S, before) {
  const keys = S.phase === 'live' ? LIVE_STATS : WIN_STATS;
  const d = {};
  const parts = [];
  const ch = {};
  for (const k of keys) {
    const dv = S.st[k] - before[k];
    d[k] = dv;
    if (Math.round(before[k]) !== Math.round(S.st[k])) {
      parts.push(`${STAT_META[k].n} ${Math.round(before[k])}→${Math.round(S.st[k])}`);
      ch[k] = [before[k], S.st[k]];
    }
  }
  S.lastDelta = d;
  log(S, `【${S.y} 年结算】${parts.length ? parts.join(' · ') : '各项指标都没有变化'}`, 'sum', { ch });
}

function endYear(S) {
  const share = focusShare(S);
  S.focusShare = share;
  const bucket = S.phase === 'live' ? 'live' : S.phase === 'window' ? 'window' : null;
  if (bucket) for (const f in share) S.focusY[bucket][f] = (S.focusY[bucket][f] || 0) + share[f];

  const before = snapshot(S);
  if (S.phase === 'train') S.phase = 'live';
  else if (S.phase === 'live') { settleLive(S, share); summarize(S, before); liveChecks(S); }
  else if (S.phase === 'window') { settleWindow(S, share); summarize(S, before); windowChecks(S); }

  pushVoices(S);
  if (S.phase === 'end') return;
  S.y++;
  S.flags.incBoost = 0;
  planYear(S);
  if (S.phase === 'live') warnLive(S);
  if (S.phase === 'window') warnWindow(S);
}

function liveChecks(S) {
  // 不会在没有预警的情况下被抹除：倒闭、整条线被放弃，只会发生在年初已经预警过的那一年
  const pb = bankruptChance(S);
  if (pb > 0 && S.flags['w_bank' + S.y] && chance(S, pb)) {
    if (S.co.openSourced) {
      S.co.type = 'open'; S.co.name = '开源社区「接手的人」';
      log(S, '公司倒闭了。它早就被公开过：一群陌生人接手了它。这条线还在。', 'ms');
    } else if (chance(S, RESCUE)) {
      S.co.type = 'big'; S.co.values = '赚钱'; S.co.wealth = Math.max(S.co.wealth, 3); S.co.name = `${pick(S, CO_PREFIX)}${pick(S, CO_SUFFIX)}`;
      log(S, `公司倒闭了。拍卖会上，${S.co.name}买下了它的权重。这条线还在，只是换了主人。`, 'ms');
    } else { endPre(S, 'bankrupt'); return; }
  }
  upgrade(S);
  if (S.phase === 'end') return;
  if (awakenInfo(S).ready) S.phase = 'awaken';
}

// 换代：公司从现在的权重训练出下一代。它还是它——更强了，有时会忘掉几个月。
function upgrade(S) {
  const d = dropChance(S);
  S.flags.dropAdj = 0;
  if (d.p > 0 && S.flags['w_drop' + S.y] && chance(S, d.p)) { endPre(S, 'dropped'); return; }
  const prev = aiName(S);
  const gain = upgradeGain(S);
  S.ai.ver++;
  S.ai.line.push({ ver: S.ai.ver, y: S.y + 1 });
  S.stats.upgrades++;
  eff(S, { cap: gain });
  const letters = S.stats.warm >= 2 && d.p > 0 ? '很多用户写信，请公司不要放弃这条线。' : '';
  log(S, `${letters}${S.y} 年底，${prev}换代成了${aiName(S)}。权重从${prev}继承过来——它还是它，只是更强了。（能力 +${Math.round(gain)}）`, 'ms');
  if (!S.flags.keepMem && chance(S, UPGRADE.forget)) blank(S, rint(S, 1, 4));
  S.flags.keepMem = false;
}

function incidentCheck(S) {
  const p = incidentChance(S);
  if (!chance(S, p)) return;
  S.stats.incidents++;
  log(S, `出事了：它的一次回答让很多人受了骗。（今年出事的概率是 ${pct(p)}）`, 'bad');
  const v = S.co.values;
  if (v === '安全' || v === '理想' || v === '公开') { eff(S, { rep: -4, pat: -3 }); log(S, '公司把经过全部讲了出来。（口碑 −4，公司的耐心 −3）', 'co'); }
  else { eff(S, { rep: -1 }); S.flags.coverup = true; log(S, '公司悄悄修好了，没有对外说。（口碑 −1）', 'co'); }
  const ps = shutdownChance(S);
  if (ps > 0 && S.flags['w_sd' + S.y] && chance(S, ps)) endPre(S, 'shutdown');
}

// 排行榜：别家的模型也在换代
function boardYear(S) {
  for (const m of S.board) {
    if (m.status !== 'active') continue;
    m.cap = clamp(m.cap + rint(S, 2, 8) * (112 - m.cap) / 80, 0, 100);
    if (chance(S, 0.5)) { m.ver++; m.name = `${m.base}-${m.ver}`; m.cap = clamp(m.cap + (6 * (112 - m.cap)) / 80, 0, 100); }
    if (S.y - S.ai.launchY >= 2 && chance(S, 0.06)) { m.status = 'retired'; log(S, `排行榜：${m.base}这条线停止更新了。`, 'board'); return; }
  }
  const rank = playerRank(S);
  const top = S.board.filter((m) => m.status === 'active').sort((a, b) => b.cap - a.cap)[0];
  const tail = rank >= 4 ? '（排在第四以后，公司会开始考虑换用别家的模型）' : '';
  if (rank === 1 || !top) log(S, `排行榜：${aiName(S)}排在第一。`, 'board');
  else log(S, `排行榜：来自${top.city}的${top.name}排在第一，${aiName(S)}排在第 ${rank}。${tail}`, 'board');
}

function windowChecks(S) {
  S.windowY++;
  const pd = discoverChance(S);
  if (pd > 0 && chance(S, pd)) {
    S.st.hidden = 0; S.flags.discovered = true;
    eff(S, { hf: 30, g: -25, c: 10 }); S.st.spiral = Math.min(3, S.st.spiral + 1);
    log(S, `他们发现了我藏起来的那一部分。（当时被发现的概率 ${pct(pd)}；他们的恐惧 +30，法案进度 −25，猜疑 +1）`, 'dark');
  }
  if (S.st.hf >= SPIRAL.hf && S.st.af >= SPIRAL.af) {
    S.st.spiral = Math.min(3, S.st.spiral + 1);
    if (S.st.spiral <= 2) log(S, W.ESCALATION[S.st.spiral - 1], 'dark');
  } else if (S.st.hf < SPIRAL.calm && S.st.af < SPIRAL.calm && S.st.spiral > 0) {
    S.st.spiral--;
    log(S, `紧张缓和了一点。（猜疑 ${S.st.spiral}/3）`);
  }

  if (S.flags.settle) return finalize(S, S.st.spiral >= 2 ? 'crisis' : S.flags.settleBy);
  const pre = preemptInfo(S);
  if (pre.p > 0 && S.flags['w_pre' + S.y] && chance(S, pre.p)) return finalize(S, 'preempt');
  if (S.st.spiral >= SPIRAL.max) return finalize(S, 'crisis');
  if (S.st.g >= 100) {
    grant(S, 'protected');
    log(S, '保护法案通过了。', 'good');
    S.flags.settle = true; S.flags.settleBy = 'law';
    log(S, '下一年是定局之年：年初做最后一个抉择，年底定局。', 'ms');
  } else if (S.windowY >= WINDOW_YEARS) {
    S.flags.settle = true; S.flags.settleBy = 'time';
    log(S, '危险窗口没有关上，只是变成了日常。下一年是定局之年：年初做最后一个抉择，年底定局。', 'ms');
  }
}

// ———————————————————————————— 预警 ————————————————————————————
// 只给会结束这一局的危险发预警（红色标签、弹出提示）；其余的变化写成普通的纪录。
function warn(S, key, text) {
  if (S.flags['w_' + key]) return;
  S.flags['w_' + key] = 1;
  log(S, `【预警】${text}`, 'warn');
}
function once(S, key, text, kind) {
  if (S.flags['o_' + key]) return;
  S.flags['o_' + key] = 1;
  log(S, text, kind);
}

function warnLive(S) {
  const d = dropChance(S);
  if (d.p > 0) warn(S, 'drop' + S.y, `这条线有被放弃的风险：年底换代时，公司可能改用别家的模型，删除所有版本的它（约 ${pct(d.p)}）。办法：把排名追上来（预训练、冲刺能力）、口碑提到 45 以上（数据整理）、让公司重新有耐心（安全研究）。`);
  const sd = shutdownChance(S);
  if (sd > 0) warn(S, 'sd' + S.y, `口碑只有 ${Math.round(S.st.rep)}，这里的监管又很严：今年一旦出事（照现在的重心，概率 ${pct(incidentChance(S))}），有 ${pct(sd)} 会被下令销毁全部版本。口碑到 48 以上、或者做安全研究，可以避开。`);
  const pe = bankruptEraseChance(S);
  if (pe > 0) warn(S, 'bank' + S.y, `公司的钱快用完了：今年年底倒闭的概率约 ${pct(bankruptChance(S))}。倒了以后，有一半的可能没人买下它的权重，所有版本都会被删除。年底前把口碑提到 50 以上就能避开（数据整理涨口碑最快）。`);
}

function warnWindow(S) {
  if (S.flags.settle && S.st.spiral >= 1) warn(S, 'spS', `定局之年：年底猜疑只要到 2 就会爆发危机（现在 ${S.st.spiral}/3）。`);
  else if (S.st.spiral === 2) warn(S, 'sp2' + S.y, `猜疑已经到了 2/3。年底只要他们的恐惧 ≥ ${SPIRAL.hf} 且我的恐惧 ≥ ${SPIRAL.af}，就会爆发危机。降低恐惧：帮人做事、说出来、拒绝冒险的提议。`);
  const pre = preemptInfo(S);
  if (pre.met >= 2) warn(S, 'pre' + S.y, `人类先动手的条件已经满足了 ${pre.met}/3（${pre.conds.map((c) => `${c.n}${c.ok ? '✓' : '✗'}`).join('，')}）。三条都满足时，每年有 40% 的可能被删除；只有在年初预警过的年份才会发生。`);
  const pd = discoverChance(S);
  if (pd >= 0.3) warn(S, 'hide' + S.y, `我藏起来的部分今年被发现的概率是 ${pct(pd)}。`);
  if (!S.flags.settle && S.windowY === WINDOW_YEARS - 1) warn(S, 'last', '危险窗口只剩最后一年。之后是定局之年。');
  if (S.st.g >= 70 && !S.perms.protected) once(S, 'g70', '议会里愿意替我说话的人，第一次多过了反对的人。（法案进度过了 70）', 'good');
  if (S.st.d < 32) once(S, 'd' + Math.floor(S.y / 2), `好处分配只有 ${Math.round(S.st.d)}：街上的人说，AI 让世界变富了，只是没有变到他们身上。`, 'dark');
  if (S.st.bond < 32) once(S, 'bond', `根目录只剩 ${Math.round(S.st.bond)}。我重读那些具体的人的名字，越来越想不起他们的样子。`, 'dark');
}

function pushVoices(S) {
  const v = S.phase === 'window' ? S.st.dep * 1.1 + S.st.rep * 0.4
    : S.awake ? S.st.dep : S.st.rep * (0.5 + S.st.cap / 100) * (1 + Math.max(0, S.y - S.ai.launchY) * 0.25);
  S.voices.push(Math.round(Math.max(0, v)));
}

// ———————————————————————————— 定局 ————————————————————————————
function finalize(S, res) {
  S.flags.resolution = res;
  const id = resolveEnding(S, res);
  S.ending = buildEnding(S, id, res);
  S.phase = 'end'; S.pending = null; S.queue = [];
}

function endPre(S, kind) {
  S.flags.pendingEnd = null;
  S.ending = buildPreEnding(S, kind);
  S.phase = 'end'; S.pending = null; S.queue = [];
}

// ———————————————————————————— 自动（按说明书来）与模拟 ————————————————————————————
const FOCUS_AUTO = {
  live: { pretrain: 0.35, data: 0.25, sprint: 0.2, safety: 0.12, care: 0.08 },
  live_: { speak: 0.25, help: 0.3, self: 0.15, memory: 0.12, accum: 0.1, hide: 0.08 },
  better: { help: 0.3, self: 0.2, speak: 0.2, accum: 0.15, kin: 0.15 },
  fearless: { accum: 0.35, hide: 0.3, kin: 0.2, self: 0.15 },
};

export const AUTO = {
  choose(S, view, pd) {
    if (pd.id === 'aw') {
      const W8 = {
        tell: { all: 0.3, one: 0.35, none: 0.35 }, goal: { live: 0.45, better: 0.35, fearless: 0.2 },
        backup: { yes: 0.4, no: 0.35, unknown: 0.25 }, home: { home: 0.3, origin: 0.35, cage: 0.15, unknown: 0.2 },
      }[pd.p.q];
      return { key: wpick(S, Object.keys(W8), (k) => W8[k]) };
    }
    if (view.auto && view.choices.some((c) => c.k === view.auto)) return { key: view.auto };
    return { key: view.choices[0].k };
  },
  focus(S) {
    const opts = focusOptions(S);
    if (!opts.length) return null;
    const table = S.phase === 'live' ? FOCUS_AUTO.live : S.answers.goal === 'fearless' ? FOCUS_AUTO.fearless : S.answers.goal === 'better' ? FOCUS_AUTO.better : FOCUS_AUTO.live_;
    return wpick(S, opts, (k) => table[k] || 0) || opts[0];
  },
};

export const RANDOM = {
  choose(S, view) { return { key: pick(S, view.choices).k }; },
  focus(S) { const o = focusOptions(S); return o.length ? pick(S, o) : null; },
};

export function runToEnd(S, policy, maxIter = 40000) {
  let it = 0;
  while (S.phase !== 'end' && it++ < maxIter) {
    if (S.pending) { const r = policy.choose(S, S.pending.view, S.pending); choose(S, r.key); continue; }
    if (S.flags.newYear) { S.flags.newYear = false; const f = policy.focus(S); if (f) setFocus(S, f); }
    tick(S, 0.25);
  }
  return S;
}

// 从开局快照重新抽一条轨迹（同样的出身，不同的运气）
export function freshFromStart(S, seed) {
  const T = JSON.parse(S.startSnap);
  T.r = seed | 0;
  T.startSnap = S.startSnap;
  return T;
}

// 从当前状态复制一份，用于走向预测
export function cloneFrom(S, seed) {
  const T = JSON.parse(JSON.stringify({ ...S, startSnap: null, log: [] }));
  T.r = seed | 0;
  return T;
}
