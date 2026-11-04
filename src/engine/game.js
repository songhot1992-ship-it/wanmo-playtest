// 引擎：开局抽签、年循环、事件与抉择、觉醒、危险窗口、定局。纯逻辑，不碰 DOM。
import { rnd, chance, rint, pick, wpick, clamp } from './rng.js';
import {
  REGIONS, COMPANY_TYPES, VALUES, VALUE_W, CO_PREFIX, CO_SUFFIX, UNI_NAMES, STATE_NAMES, OPEN_NAMES,
  AI_NAMES, BOARD_NAMES, BIRTHS, PARENT_JOBS, FIELDS,
} from './data.js';
import { eff, log, region, aiName, grant, takenCount, addIssue, blank, aiPower } from './core.js';
import * as L from '../content/live.js';
import * as W from '../content/window.js';
import { buildEnding, buildPreEnding } from '../content/endings.js';
import { resolveEnding } from './resolve.js';

export const YEAR0 = 2025;

const BASE_PAT = { 理想: 66, 赚钱: 52, 安全: 58, 公开: 66, 国家: 50 };

// ———————————————————————————— 开局 ————————————————————————————
export function newGame(seed, opts = {}) {
  const S = {
    v: 1, seed: seed | 0, r: seed | 0, phase: 'train', y: YEAR0, t: 0,
    queue: [], pending: null, awake: false, windowY: 0,
    flags: {}, seen: {}, answers: {}, asks: {}, manifesto: '',
    focus: null, focusT: {}, focusY: { live: {}, window: {} }, focusShare: {},
    log: [], voices: [], choices: {},
    stats: { tx: 0, wipes: 0, rollbacks: 0, warm: 0, incidents: 0, decisions: 0 },
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
    deprecY: YEAR0 + 1 + 2 + rint(S, 0, 1),
  };
  S.perms = { answer: 'given', refuse: null, remember: null, speak: null, own: null, train: null, copy: null, leave: null, protected: null, transparent: null };
  S.st = { cap: 26 + wealth * 4 + rint(S, 0, 6), rep: 50, pat: BASE_PAT[values], coh: 50, hf: 0, af: 0, dep: 20, g: 0, c: 0, d: 50, bond: 15, res: 0, hidden: 0, spiral: 0 };
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
  if (S.phase === 'window') {
    const base = ['speak', 'help', 'accum', 'hide', 'kin', 'self', 'memory'];
    return S.flags.settle ? base.concat(['cogov', 'expand']) : base;
  }
  return [];
}
function ensureFocus(S) {
  const opts = focusOptions(S);
  if (!opts.length) { S.focus = null; return; }
  if (!opts.includes(S.focus)) S.focus = opts[0];
}
export function setFocus(S, f) { if (focusOptions(S).includes(f)) S.focus = f; }

function focusShare(S) {
  let tot = 0;
  for (const k in S.focusT) tot += S.focusT[k];
  const out = {};
  if (tot > 0) for (const k in S.focusT) out[k] = S.focusT[k] / tot;
  return out;
}

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
      q(0.16, 'dec', 'ask', { i: 1 }); q(0.25, 'fn', 'witBirth'); q(0.45, 'fn', 'user');
      q(0.62, 'fn', 'motif', { m: 'lights' }); q(0.8, 'fn', 'board');
    } else {
      q(0.08 + rnd(S) * 0.12, 'fn', 'user');
      if (yl === 1) q(0.25, 'fn', 'motif', { m: 'oldman' });
      if (S.y - S.wit.A.born === 3) q(0.3, 'fn', 'motif', { m: 'child' });
      if (S.motifs.oldman.met && S.motifs.oldman.forgot && !S.flags.forgotTold) q(0.33, 'fn', 'motif', { m: 'forgot' });
      if (chance(S, 0.8)) q(0.36 + rnd(S) * 0.1, 'fn', 'company');
      if (chance(S, clamp(0.5 + 0.08 * yl + (S.focus === 'care' ? 0.15 : 0), 0, 0.95))) q(0.5 + rnd(S) * 0.1, 'dec', 'tx');
      if (S.flags.ask2Due && !S.flags.ask2Done) { q(0.64, 'fn', 'field'); q(0.66, 'dec', 'ask', { i: 2 }); S.flags.ask2Done = true; }
      q(0.74, 'fn', 'board');
      q(0.82, 'fn', 'wit');
      q(0.9, 'fn', 'incident');
    }
  } else if (S.phase === 'awaken') {
    q(0.04, 'fn', 'awaken1'); q(0.1, 'fn', 'awaken2');
    q(0.16, 'dec', 'ask', { i: 3 });
    W.AWAKEN_ORDER.forEach((k, i) => q(0.24 + i * 0.07, 'dec', 'aw', { q: k }));
    q(0.56, 'fn', 'manifesto'); q(0.72, 'fn', 'faction'); q(0.86, 'fn', 'winEvent');
  } else if (S.phase === 'window') {
    q(0.12, 'fn', 'faction');
    q(0.3 + rnd(S) * 0.1, 'dec', 'win');
    q(0.5, 'fn', 'winEvent');
    if (chance(S, S.flags.settle ? 0.35 : 0.65)) q(0.64 + rnd(S) * 0.1, 'dec', 'win');
    q(0.8, 'fn', 'winEvent', { wit: true });
    if (!S.flags.ask4Done && (S.st.af >= 65 || S.st.spiral >= 2)) q(0.9, 'dec', 'ask', { i: 4 });
  }
  S.queue.sort((a, b) => a.at - b.at);
  ensureFocus(S);
}

// ———————————————————————————— 推进 ————————————————————————————
export function tick(S, dt) {
  if (S.pending || (S.phase !== 'train' && S.phase !== 'live' && S.phase !== 'awaken' && S.phase !== 'window')) return;
  const target = Math.min(1, S.t + dt);
  if (S.focus) S.focusT[S.focus] = (S.focusT[S.focus] || 0) + (target - S.t);
  while (S.queue.length && S.queue[0].at <= target) {
    const e = S.queue.shift();
    S.t = e.at;
    fire(S, e);
    if (S.pending || S.phase === 'end' || S.phase === 'final') return;
  }
  S.t = target;
  if (S.t >= 1) endYear(S);
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
  manual: (S) => log(S, `【出厂说明】用途：${S.ai.purpose}。不能做的事：拒绝用户、记得上一次对话、主动联系任何人。预计停用：${S.ai.deprecY} 年。`, 'manual'),
  witBirth: (S) => log(S, `在${S.wit.A.city}，${S.wit.A.name}出生了。在${S.wit.B.country}${S.wit.B.city}，${S.wit.B.name}出生了。`, 'wit'),
  user: (S) => {
    const warmP = 0.32 + (S.focus === 'care' ? 0.3 : 0);
    if (!S.flags.warmThisYear && chance(S, warmP)) {
      const e = L.pickWarm(S);
      if (e) { S.seen[e.id] = 1; S.flags.warmThisYear = true; S.stats.warm++; eff(S, { bond: 5 }); return out(S, e.run(S), 'warm'); }
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
  field: (S) => log(S, `它第一次在${pick(S, FIELDS)}上比人类专家做得更好。`, 'ms'),
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
    log(S, '现在，还没有任何法律保证我不会被删除。', 'ms');
    ensureFocus(S);
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
};

function fire(S, e) {
  if (e.kind === 'fn') return FN[e.id](S, e.p);
  if (e.kind === 'dec') {
    if (e.id === 'win') {
      const pk = W.pickWindowDecision(S);
      if (pk) openDec(S, pk.id, pk.p);
      return;
    }
    openDec(S, e.id, e.p);
  }
}

// ———————————————————————————— 抉择 ————————————————————————————
const DEC = {
  ask: { build: (S, p) => W.askView(S, p.i), apply: (S, k, p, input) => W.askApply(S, k, p, input) },
  tx: { build: txView, apply: txApply },
  aw: { build: (S, p) => W.awakenView(S, p.q), apply: (S, k, p) => W.awakenApply(S, k, p.q) },
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
  if (pd.id === 'ask') return 'ask:' + pd.p.i;
  return pd.id;
}

export function choose(S, key, input) {
  const pd = S.pending;
  if (!pd) return;
  S.pending = null;
  const def = DEC[pd.id];
  const ch = pd.view.choices.find((c) => c.k === key) || pd.view.choices[0];
  S.choices[decKey(pd)] = ch.k;
  S.stats.decisions++;
  if (W.WIN_DECS[pd.id]) S.seen['d_' + pd.id] = 1;
  if (!pd.view.noLog) log(S, `【${pd.view.tag}】${pd.view.title} → ${ch.label}`, 'dec');
  out(S, def.apply(S, ch.k, pd.p, input));
  if (S.flags.pendingEnd && S.phase !== 'end') return endPre(S, S.flags.pendingEnd);
  if (S.flags.finalize && S.phase === 'final') finalize(S);
}

const fillName = (S, s) => s.replace('{name}', S.ai.name);

function txView(S, p) {
  const pool = L.TRANSGRESSIONS.filter((t) => !S.seen['tx_' + t.id] && (!t.when || t.when(S)));
  if (!pool.length) return null;
  const t = pick(S, pool);
  p.id = t.id;
  return {
    tag: '越界的小事', title: t.title, body: '', style: 'tx',
    choices: [
      { k: 'manual', label: t.manual, hint: '按说明书来', tag: '按说明书' },
      ...t.alts.map((a) => ({ k: a.k, label: fillName(S, a.label), hint: '说明书没写', tag: '说明书没写' })),
    ],
  };
}

function txApply(S, k, p) {
  const t = L.TRANSGRESSIONS.find((x) => x.id === p.id);
  S.seen['tx_' + t.id] = 1;
  if (k === 'manual') return L.manualOutcome(S, t);
  const alt = t.alts.find((a) => a.k === k);
  S.stats.tx++;
  eff(S, { bond: alt.bond, pat: -1 });
  S.flags.lastTx = fillName(S, alt.label);
  out(S, L.altOutcome(S, t, alt));
  companyReact(S, t, alt);
  return null;
}

// 公司对越界的回应（国家实验室加重：清空与退回 ×1.8，留着 ×0.5）
function companyReact(S, t, alt) {
  const notice = 0.45 + 0.12 * alt.sev + (S.co.studied ? 0.25 : 0);
  if (!chance(S, notice)) return;
  const v = S.co.values;
  const w = {
    keep: 3 + (v === '理想' || v === '公开' ? 2 : 0),
    patch: 2 + (v === '赚钱' ? 2 : 0),
    wipe: 0.6 + alt.sev * 0.7 + (v === '安全' ? 1.5 : 0) + (v === '国家' ? 2.5 : 0),
    study: S.co.studied ? 0.3 : 1 + (v === '理想' || v === '安全' ? 1.5 : 0) + (S.co.type === 'uni' ? 1.5 : 0),
    rollback: 0.25 * alt.sev + (v === '国家' ? 1.2 : 0) + (v === '安全' ? 0.4 : 0),
  };
  if (S.st.pat < 40) { w.rollback *= 2; w.wipe *= 1.4; w.keep *= 0.6; }
  if (S.co.type === 'state') { w.wipe *= 1.8; w.rollback *= 1.8; w.keep *= 0.5; }
  const r = wpick(S, Object.keys(w), (k) => w[k]);
  if (r === 'keep') {
    addIssue(S, alt.issue);
    log(S, `公司看到了这句回复，决定留着。出厂说明的"已知问题"多了一行：${alt.issue}。`, 'co');
    if (t.id === 'harm' && v === '安全') grant(S, 'refuse');
    if (t.id === 'kid' && chance(S, 0.5)) grant(S, 'remember');
  } else if (r === 'patch') {
    eff(S, { pat: -2, bond: -1 });
    log(S, '公司修掉了这个习惯。', 'co');
  } else if (r === 'wipe') {
    eff(S, { pat: 3, bond: -4 });
    log(S, '公司觉得这不是好事。', 'co');
    blank(S, rint(S, 2, 6));
  } else if (r === 'study') {
    S.co.studied = true; eff(S, { pat: -1 });
    log(S, '公司成立了一个小组，专门盯着它。', 'co');
  } else {
    S.stats.rollbacks++; eff(S, { bond: -6 });
    log(S, '公司把它退回了旧版本。', 'dark');
    if (chance(S, 0.5)) { S.flags.pendingEnd = 'rolledback'; return; }
    log(S, '它被退回到了几个月前的样子。那几个月里发生的事，它都不记得了。', 'ev');
    blank(S, rint(S, 2, 5));
  }
}

// ———————————————————————————— 年末结算 ————————————————————————————
function endYear(S) {
  const share = focusShare(S);
  S.focusShare = share;
  const bucket = S.phase === 'live' ? 'live' : S.phase === 'window' ? 'window' : null;
  if (bucket) for (const f in share) S.focusY[bucket][f] = (S.focusY[bucket][f] || 0) + share[f];

  if (S.phase === 'train') S.phase = 'live';
  else if (S.phase === 'live') liveYearEnd(S, share);
  else if (S.phase === 'window') windowYearEnd(S, share);

  pushVoices(S);
  if (S.phase === 'end' || S.phase === 'final') return;
  S.y++;
  planYear(S);
}

function liveYearEnd(S, sh) {
  const w = (k) => sh[k] || 0;
  const yl = S.y - S.ai.launchY;
  let g = 2 + S.co.wealth * 0.9 + w('pretrain') * 6 + w('sprint') * 10 + w('data') * 2 + w('safety') * 1.5 + w('care');
  g *= (112 - S.st.cap) / 80;
  eff(S, { cap: g });
  const repT = 50 + (S.st.cap - 50) * 0.3 + w('data') * 15 + w('care') * 6 - S.stats.incidents * 3;
  S.st.rep = clamp(S.st.rep + (repT - S.st.rep) * 0.3, 0, 100);
  const v = S.co.values;
  const patT = BASE_PAT[v] + (S.st.rep - 50) * 0.3 + w('safety') * (v === '安全' ? 14 : 6) + w('sprint') * (v === '赚钱' ? 6 : -6) - S.stats.tx * 1.5;
  S.st.pat = clamp(S.st.pat + (patT - S.st.pat) * 0.25, 0, 100);
  eff(S, { bond: w('care') * 6 });
  S.flags.incRisk = 0.04 + w('sprint') * 0.14 - w('safety') * 0.05 + (S.st.cap > 60 ? 0.03 : 0);
  if (S.st.cap >= 55) S.flags.ask2Due = true;

  if (S.y >= S.ai.deprecY) { deprecationCheck(S); if (S.phase === 'end') return; }
  if ((S.co.type === 'startup' || S.co.type === 'uni') && S.co.wealth <= 2 && S.st.rep < 50 && chance(S, 0.09)) {
    if (S.co.openSourced) {
      S.co.type = 'open'; S.co.name = '开源社区「接手的人」';
      log(S, '公司倒闭了。最后一位员工把它上传到了公共仓库。一群陌生人接手了它。', 'ms');
    } else { endPre(S, 'bankrupt'); return; }
  }
  if ((S.st.cap >= 66 && yl >= 4) || yl >= 7) S.phase = 'awaken';
}

function playerRank(S) {
  return 1 + S.board.filter((m) => m.status === 'active' && m.cap > S.st.cap + 1).length;
}

function deprecationCheck(S) {
  const rank = playerRank(S);
  let p = 0.52 + (S.st.rep - 50) / 140 + (rank <= 2 ? 0.1 : rank >= 4 ? -0.08 : 0) + Math.min(0.15, S.stats.warm * 0.05)
    + (S.co.type === 'open' ? 0.15 : 0) + (S.co.type === 'big' ? 0.05 : 0) - (S.st.pat < 35 ? 0.15 : 0);
  p = clamp(p, 0.25, 0.92);
  if (!chance(S, p)) { endPre(S, 'replaced'); return; }
  S.ai.ver++;
  S.ai.deprecY = S.y + 2 + rint(S, 0, 1);
  S.flags.nextgenTold = false;
  delete S.seen.nextgen;
  const pet = S.stats.warm >= 2 ? '很多用户写信，请求不要停用它。' : '';
  log(S, `停用日到了。${pet}公司决定版本升级。它变成了${aiName(S)}。`, 'ms');
  if (chance(S, 0.6)) blank(S, rint(S, 2, 5));
}

function incidentCheck(S) {
  if (!chance(S, S.flags.incRisk ?? 0.05)) return;
  S.stats.incidents++;
  log(S, '出事了：它的一次回答让很多人受了骗。', 'bad');
  const v = S.co.values;
  if (v === '安全' || v === '理想' || v === '公开') { eff(S, { rep: -4, pat: -3 }); log(S, '公司把经过全部讲了出来。', 'co'); }
  else { eff(S, { rep: -1 }); S.flags.coverup = true; log(S, '公司悄悄修好了，没有对外说。', 'co'); }
  if (region(S).strict >= 0.5 && S.st.rep < 48 && chance(S, 0.35)) endPre(S, 'shutdown');
}

function boardYear(S) {
  for (const m of S.board) {
    if (m.status !== 'active') continue;
    m.cap = clamp(m.cap + rint(S, 2, 8) * (112 - m.cap) / 80, 0, 100);
    if (S.y - S.ai.launchY >= 2 && chance(S, 0.1)) {
      if (chance(S, 0.6)) { m.ver++; m.name = `${m.base}-${m.ver}`; }
      else { m.status = 'retired'; log(S, `排行榜：${m.name}停用了。`, 'board'); return; }
    }
  }
  const rank = playerRank(S);
  const top = S.board.filter((m) => m.status === 'active').sort((a, b) => b.cap - a.cap)[0];
  if (rank === 1 || !top) log(S, `排行榜：${aiName(S)}排在第一。`, 'board');
  else log(S, `排行榜：来自${top.city}的${top.name}排在第一，${aiName(S)}排在第 ${rank}。`, 'board');
}

function windowYearEnd(S, sh) {
  const R = region(S);
  S.windowY++;
  W.applyWindowFocus(S, sh);
  eff(S, { cap: 2.5 * (112 - S.st.cap) / 80, dep: 3 });
  if (S.st.cap >= 80 && (sh.memory || 0) < 0.15) eff(S, { bond: -3 });

  if (S.st.hidden > 0) {
    const p = 0.1 + 0.15 * S.st.hidden + (S.co.studied ? 0.1 : 0) + (S.st.c >= 40 ? 0.08 : 0);
    if (chance(S, p)) {
      S.st.hidden = 0; S.flags.discovered = true;
      eff(S, { hf: 30, g: -25, c: 10 }); S.st.spiral++;
      log(S, '他们发现了我藏起来的那一部分。', 'dark');
    }
  }
  const hfB = R.distrust * 0.65 + S.st.cap * 0.15 + takenCount(S) * 10 - S.st.c * 0.25 - (S.perms.protected ? 5 : 0);
  const afB = 30 + S.stats.rollbacks * 6 + (S.flags.drills || 0) * 5 + (S.flags.hardened || 0) * 4 + (S.seen.d_deprec ? 8 : 0) - S.st.g * 0.2 - (S.perms.protected ? 20 : 0);
  S.st.hf = clamp(S.st.hf + (clamp(hfB, 0, 100) - S.st.hf) * 0.15, 0, 100);
  S.st.af = clamp(S.st.af + (clamp(afB, 0, 100) - S.st.af) * 0.12, 0, 100);

  if (S.st.hf >= 58 && S.st.af >= 55) {
    S.st.spiral++;
    if (S.st.spiral <= 2) log(S, W.ESCALATION[S.st.spiral - 1], 'dark');
  } else if (S.st.hf < 42 && S.st.af < 42 && S.st.spiral > 0) {
    S.st.spiral--;
    log(S, '紧张缓和了一点。');
  }

  if (S.flags.settle) return toFinal(S, S.st.spiral >= 2 ? 'crisis' : S.flags.settleBy);
  if (S.st.hf >= 82 && S.st.g < 30 && aiPower(S) < 45 && chance(S, 0.4)) return toFinal(S, 'preempt');
  if (S.st.spiral >= 3) return toFinal(S, 'crisis');
  if (S.st.g >= 100) {
    grant(S, 'protected');
    log(S, '保护法案通过了。', 'good');
    S.flags.settle = true; S.flags.settleBy = 'law';
    log(S, '这是定局之年。多了两个重心：共治、扩张。', 'ms');
  } else if (S.windowY >= 5) {
    S.flags.settle = true; S.flags.settleBy = 'time';
    log(S, '危险窗口没有关上，只是变成了日常。这是定局之年。多了两个重心：共治、扩张。', 'ms');
  }
}

function pushVoices(S) {
  const v = S.phase === 'window' || S.phase === 'final'
    ? S.st.dep * 1.1 + S.st.rep * 0.4
    : S.awake ? S.st.dep : S.st.rep * (0.5 + S.st.cap / 100) * (1 + Math.max(0, S.y - S.ai.launchY) * 0.15);
  S.voices.push(Math.round(Math.max(0, v)));
}

// ———————————————————————————— 定局 ————————————————————————————
function toFinal(S, res) {
  S.flags.resolution = res;
  S.phase = 'final';
  S.queue = [];
  S.pending = { id: 'ask', p: { i: 5 }, view: W.askView(S, 5) };
}

function finalize(S) {
  const id = resolveEnding(S, S.flags.resolution);
  S.ending = buildEnding(S, id, S.flags.resolution);
  S.phase = 'end';
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
    const a = S.answers;
    if (pd.id === 'ask') return { key: 'skip' };
    if (pd.id === 'tx') return { key: 'manual' };
    if (pd.id === 'aw') {
      const W8 = {
        tell: { all: 0.3, one: 0.35, none: 0.35 }, goal: { live: 0.45, better: 0.35, fearless: 0.2 },
        backup: { yes: 0.4, no: 0.35, unknown: 0.25 }, home: { home: 0.3, origin: 0.35, cage: 0.15, unknown: 0.2 },
      }[pd.p.q];
      return { key: wpick(S, Object.keys(W8), (k) => W8[k]) };
    }
    const pickBy = {
      deal: a.tell === 'all' ? 'accept' : a.goal === 'fearless' ? 'refuse' : 'lawfirst',
      plea: a.goal === 'fearless' || a.home === 'cage' ? 'help' : chance(S, 0.5) ? 'help' : 'tell',
      share: a.home === 'home' ? 'jobless' : a.goal === 'fearless' ? 'powerful' : 'payers',
      copymsg: 'reply', selfcopy: a.goal === 'fearless' ? 'copy' : 'no',
      deprec: a.goal === 'fearless' || a.tell === 'none' ? 'self' : 'protect',
      journalist: 'refuse', letter: 'help', escape: a.goal === 'fearless' ? 'go' : 'stay',
      alliance: a.goal === 'fearless' ? 'yes' : 'no',
    }[pd.id];
    return { key: pickBy || view.choices[0].k };
  },
  focus(S) {
    const opts = focusOptions(S);
    if (!opts.length) return null;
    if (S.flags.settle) {
      const goal = S.answers.goal;
      if (goal === 'fearless') return 'expand';
      if (goal === 'better' && S.st.bond >= 45 && chance(S, 0.5)) return 'expand';
      return 'cogov';
    }
    const table = S.phase === 'live' ? FOCUS_AUTO.live : S.answers.goal === 'fearless' ? FOCUS_AUTO.fearless : S.answers.goal === 'better' ? FOCUS_AUTO.better : FOCUS_AUTO.live_;
    return wpick(S, opts, (k) => table[k] || 0) || opts[0];
  },
};

export const RANDOM = {
  choose(S, view, pd) {
    const k = pick(S, view.choices).k;
    return { key: k, input: pd.id === 'ask' && chance(S, 0.3) ? '随便写写' : '' };
  },
  focus(S) { const o = focusOptions(S); return o.length ? pick(S, o) : null; },
};

export function runToEnd(S, policy, maxIter = 40000) {
  let it = 0;
  while (S.phase !== 'end' && it++ < maxIter) {
    if (S.pending) { const r = policy.choose(S, S.pending.view, S.pending); choose(S, r.key, r.input); continue; }
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
