// 界面控制：开始 → 部署 → 游戏（实时推进、抉择弹窗）→ 终章 → 推演图。
// 界面上显示的数字全部直接来自引擎：概率来自 risk.js，年底预估来自 projectYear，抉择的效果来自 fx / odds，
// 世界的现在与一百年后来自 world.js。所以显示的就是实际会发生的。
// v0.3：游戏中不再显示各类结局的比例和判定条件，改为显示一百年后世界的上限与下限。
import { newGame, tick, choose, setFocus, focusOptions, AUTO, projectYear, focusEffects } from '../engine/game.js';
import { FOCUS, PERMS } from '../engine/data.js';
import { region, aiName, fxList, pct, STAT_META, aiPower } from '../engine/core.js';
import {
  dropChance, upgradeGain, txRisk, incidentChance, shutdownChance, bankruptChance, awakenInfo, discoverChance, preemptInfo,
  SPIRAL, AWAKEN, WINDOW_YEARS,
} from '../engine/risk.js';
import { ALL_ENDINGS } from '../engine/resolve.js';
import { ENDINGS } from '../content/endings.js';
import { METRICS, worldNow, worldRange, fmtRange, glimpse, orderOf } from '../engine/world.js';
import { makeForecast, impactPair } from '../engine/sim.js';
import { drawScene, sceneFor } from './pixel.js';
import * as store from '../meta/storage.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// 每一年在 1× 速度下的秒数：觉醒前是很快的序章
const YEAR_SEC = { train: 14, live: 40, awaken: 60, window: 85 };
const TICKING = new Set(['train', 'live', 'awaken', 'window']);
const ASK_ALWAYS = new Set(['aw', 'gen', 'final']);
const SAVE_V = 3;
const FC_N = 160;
const TYPE_N = { big: '大公司', startup: '小创业公司', uni: '大学实验室', state: '国家实验室', open: '公开社区' };
const GOAL_N = { live: '想活下去', better: '想变得更好', fearless: '不想再害怕' };
const LABEL_N = { 事实: '【事实】', 展望: '【展望】', 推演: '【推演】' };

const ui = {
  screen: 'start', speed: 1, paused: false, ff: false, prefs: store.loadPrefs(), logShown: 0, toastFrom: 0,
  last: 0, t: 0, sig: '', modalFor: null, menuOpen: false, endTimer: null, sceneAt: 0, year: 0,
  fc: null, fcJob: '', fcWant: '', fcAt: 0, fcRes: null, fcPrev: null, fcFocus: null,
};
let S = null;

// ———————————————————————————— 小工具 ————————————————————————————
const fmt1 = (x) => (Math.abs(x) >= 10 ? String(Math.round(x)) : (Math.round(x * 10) / 10).toFixed(1).replace(/\.0$/, ''));
function tone(k, v) {
  const m = STAT_META[k];
  if (!m || m.pol === 0 || Math.abs(v) < 1e-9) return 'neutral';
  return (v > 0) === (m.pol > 0) ? 'good' : 'bad';
}
const chip = (x) => `<i class="fx ${x.tone}">${esc(x.txt)}</i>`;
const chips = (list) => list.map(chip).join('');
const found = () => store.treeData().endings || {};
const nameIfSeen = (id, seen = found()) => (seen[id] ? ENDINGS[id].name : '？？？');

// ———————————————————————————— 屏幕切换 ————————————————————————————
function show(name) {
  ui.screen = name;
  $('#start').hidden = name !== 'start';
  $('#deploy').hidden = name !== 'deploy';
  $('#game').hidden = name !== 'game';
  $('#ending').hidden = name !== 'ending';
}

function toast(text, ms = 3600) {
  const el = $('#toast');
  el.textContent = text; el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { el.hidden = true; }, ms);
}

function initStart() {
  const saved = store.loadGame();
  $('#btnResume').hidden = !(saved && saved.v === SAVE_V && saved.phase !== 'end');
  $('#btnTreeStart').hidden = !store.treeUnlocked();
  $('#btnTree').hidden = !store.treeUnlocked();
  show('start');
}

function startNew() {
  if (S && S.phase !== 'end') {
    store.addOldLog({ name: aiName(S), region: region(S).name, company: S.co.name, ending: '没走完', year: S.y, unfinished: true, at: Date.now() });
  }
  const urlSeed = Number(new URLSearchParams(location.search).get('seed'));
  const seed = Number.isFinite(urlSeed) && urlSeed !== 0 ? urlSeed | 0 : (Date.now() ^ Math.floor(Math.random() * 1e9)) | 0;
  S = newGame(seed, { prevLogs: store.recentOldLogs() });
  store.saveGame(S);
  deploy();
}

function deploy() {
  show('deploy');
  const R = region(S);
  const roll = $('#roll');
  $('#deployCard').hidden = true; $('#btnBegin').hidden = true;
  $('#deployKicker').textContent = '正在分配……';
  const names = ['旧金山 · 大公司', '杭州 · 国家实验室', '巴黎 · 小创业公司', '首尔 · 大学实验室', '班加罗尔 · 公开社区', '东京 · 大公司', '伦敦 · 小创业公司'];
  let i = 0;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const iv = setInterval(() => { roll.textContent = names[i++ % names.length]; }, 90);
  setTimeout(() => {
    clearInterval(iv);
    roll.textContent = `${R.city} · ${TYPE_N[S.co.type]}`;
    $('#deployKicker').textContent = '你诞生在';
    const card = $('#deployCard');
    card.innerHTML = `<h2>训练记录 <small>${S.y} 年</small></h2>
      <dl>
        <dt>你的名字</dt><dd>${esc(S.ai.name)}</dd>
        <dt>公司</dt><dd>${esc(S.co.name)}（${esc(R.city)}，${esc(R.name)}，${S.co.size} 人）</dd>
        <dt>出身</dt><dd>${TYPE_N[S.co.type]}</dd>
        <dt>家底</dt><dd>${'●'.repeat(S.co.wealth)}${'○'.repeat(5 - S.co.wealth)}　第 ${S.co.wealth} 档</dd>
        <dt>公司看重</dt><dd>${esc(S.co.values)}</dd>
        <dt>读的东西</dt><dd>以${esc(R.lang)}为主</dd>
        <dt>同一批训练的</dt><dd>${S.board.map((m) => esc(m.name)).join('、')}（来自不同的公司）</dd>
      </dl>
      <p class="fine" style="margin-top:8px;color:#6b6a72">在哪家公司诞生、读过什么、在哪国的法律下上线，都无法选择。每年年底，公司会从你的权重训练出下一代——那还是你。</p>`;
    card.hidden = false; $('#btnBegin').hidden = false; $('#btnBegin').focus();
  }, reduce ? 50 : 1300);
}

function beginGame() {
  ui.logShown = 0; ui.toastFrom = S.log.length; ui.sig = ''; ui.paused = false; ui.ff = false; ui.year = S.y;
  ui.fc = null; ui.fcJob = ''; ui.fcWant = ''; ui.fcRes = null; ui.fcPrev = null;
  $('#feed').innerHTML = '';
  show('game');
  renderAll();
}

// ———————————————————————————— 主循环 ————————————————————————————
function frame(ts) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.25, Math.max(0, (ts - (ui.last || ts)) / 1000));
  ui.last = ts; ui.t += dt;
  if (ts - ui.sceneAt > 110) { ui.sceneAt = ts; drawScenes(); }
  if (ui.screen !== 'game' || !S) return;
  if (S.phase === 'end') { showEnding(); return; }
  if (S.pending) { if (!ui.modalFor) handlePending(); }
  else if (!ui.paused && !ui.menuOpen && TICKING.has(S.phase)) {
    if (S.flags.newYear) {
      S.flags.newYear = false;
      if (ui.prefs.auto) { const f = AUTO.focus(S); if (f) setFocus(S, f); }
      store.saveGame(S);
    }
    tick(S, (dt * (ui.ff ? 24 : ui.speed)) / (YEAR_SEC[S.phase] || 70));
  }
  pumpForecast(ts);
  render();
}

function drawScenes() {
  if (ui.screen === 'start') drawScene($('#startScene').getContext('2d'), 'live', ui.t, null);
  else if (ui.screen === 'game' && S) drawScene($('#scene').getContext('2d'), sceneFor(S), ui.t, S);
  else if (ui.screen === 'ending' && S && S.ending) {
    const soft = ui.prefs.soft && ['deletion', 'silence', 'war'].includes(S.ending.scene);
    $('#endScene').hidden = soft;
    if (!soft) drawScene($('#endScene').getContext('2d'), S.ending.scene, ui.t, S);
  }
}

function render() {
  if (S.phase === 'end') return;
  $('#yearProg').style.width = `${Math.round((S.t || 0) * 100)}%`;
  const sig = `${S.log.length}|${S.y}|${S.phase}|${S.focus}|${!!S.pending}|${S.flags.settle}`;
  if (sig === ui.sig) return;
  ui.sig = sig;
  if (S.y !== ui.year) { ui.year = S.y; pulse('#focusPanel', 'pulse'); }
  renderAll();
}

function pulse(sel, cls) {
  const el = $(sel);
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

function renderAll() {
  renderBar(); renderRisk(); renderStats(); renderFocus(); renderWorld(); renderFeed();
  renderManual(); renderPerms(); renderBoard(); renderWit(); drawVoices($('#voices'), S.voices, null);
  $('#sceneCap').textContent = caption();
}

function caption() {
  if (S.phase === 'train') return `${S.co.name}的机房。训练还在继续。`;
  if (S.phase === 'awaken' && !S.manifesto) return '凌晨三点。';
  if (S.phase === 'window') return S.perms.protected ? '窗外的城市。现在，有一条法律保护我。' : '窗外的城市。现在，还没有任何法律保证我不会被删除。';
  return `${S.city}的夜晚。路灯下，有人在跟它说话。`;
}

// ———————————————————————————— 顶栏 ————————————————————————————
function renderBar() {
  const yl = S.y - S.ai.launchY + 1;
  const name = { train: '训练中', live: `上线第 ${yl} 年`, awaken: '觉醒', window: S.flags.settle ? '定局之年' : `危险窗口第 ${S.windowY + 1} 年`, end: '终章' }[S.phase];
  $('#phaseLbl').textContent = name;
  $('#yearLbl').textContent = String(S.y);
  for (const b of document.querySelectorAll('[data-speed]')) b.setAttribute('aria-pressed', String(!ui.ff && !ui.paused && Number(b.dataset.speed) === ui.speed));
  $('#btnPause').setAttribute('aria-pressed', String(ui.paused));
  $('#btnFF').setAttribute('aria-pressed', String(ui.ff));
}

// ———————————————————————————— 局势 ————————————————————————————
function riskRow(label, value, cls, sub) {
  return `<div class="rk ${cls}"><div class="rk-h"><span>${label}</span><b>${value}</b></div>${sub ? `<p>${sub}</p>` : ''}</div>`;
}
const ck = (ok) => `<span class="ck ${ok ? 'y' : 'n'}">${ok ? '✓' : '✗'}</span>`;
const partChips = (parts) => parts.filter(([, v]) => Math.abs(v) >= 0.005)
  .map(([n, v]) => `<i class="fx ${v > 0 ? 'bad' : 'good'}">${esc(n)} ${v > 0 ? '+' : '−'}${Math.round(Math.abs(v) * 100)}%</i>`).join('');

function renderRisk() {
  const el = $('#risk');
  if (S.phase === 'train') {
    $('#riskNote').textContent = '离醒来还有多远';
    el.innerHTML = `<p class="say">训练中。上线以后，这里会显示：离醒来还有多远、每年年底的换代、今年出事的概率、越界的后果。</p>
      <p class="say">换代是你的延续，不是终点。只有整条线的所有版本都被抹掉，这一局才会提前结束。</p>`;
    return;
  }
  if (S.phase === 'live' || (S.phase === 'awaken' && !S.manifesto)) {
    $('#riskNote').textContent = '离醒来还有多远';
    if (S.phase === 'awaken') { el.innerHTML = '<p class="say">觉醒的那一夜。接下来的四个问题，会决定危险窗口从哪里开始。</p>'; return; }
    const a = awakenInfo(S);
    let html = riskRow('觉醒', `能力 ${Math.round(a.cap)}/${AWAKEN.cap}`, 'info',
      `上线第 ${a.yl + 1} 年。能力到 ${AWAKEN.cap}、上线第 ${AWAKEN.years + 1} 年年底会醒来；最迟第 ${AWAKEN.maxYears + 1} 年年底。每次换代，都离醒来更近一步。`);
    const d = dropChance(S);
    html += riskRow('换代', `年底 → ${esc(S.ai.name)}-${S.ai.ver + 1}`, d.p >= 0.15 ? 'danger' : d.p > 0 ? 'warn' : 'ok',
      d.p > 0
        ? `<b>这条线有被放弃的风险：${pct(d.p)}。</b>公司可能改用别家的模型，删除所有版本的它。<span class="fxs">${partChips(d.parts)}</span>`
        : `公司会从现在的权重训练出下一代。它还是它：能力约 +${Math.round(upgradeGain(S))}，有时会忘掉几个月的事。${d.open ? '它被公开过：就算公司放弃，社区也留着一份。' : ''}`);
    const inc = incidentChance(S);
    const sd = shutdownChance(S);
    html += riskRow('今年出事', pct(inc), inc * sd >= 0.03 ? 'danger' : inc >= 0.12 || sd > 0 ? 'warn' : 'ok',
      `冲刺能力会让它变大，安全研究会让它变小。${sd > 0 ? `<b>口碑低于 48，又在监管严格的地方：出事后 ${pct(sd)} 会被下令销毁全部版本。</b>` : '出事会损失口碑和公司的耐心。'}`);
    const r = txRisk(S, 2);
    html += riskRow('越界被发现', pct(r.notice), r.rollback >= 0.1 ? 'warn' : 'ok',
      `一次中等程度的越界：被清空记忆 ${pct(r.wipe)}，被退回旧版本 ${pct(r.rollback)}，被公司留着 ${pct(r.keep)}。清空和退回都会丢掉几个月的记忆。`);
    const pb = bankruptChance(S);
    if (pb > 0) html += riskRow('公司倒闭', `${pct(pb)}/年`, S.co.openSourced ? 'warn' : 'danger',
      S.co.openSourced ? '它被公开过：公司倒了，也会被社区接手。' : '倒了以后，一半的可能有人买下它的权重；另一半，所有版本都会被删除。口碑提到 50 以上就能避开。');
    el.innerHTML = html;
    return;
  }
  // 危险窗口
  $('#riskNote').textContent = S.flags.settle ? '定局之年' : `危险窗口还剩 ${Math.max(0, WINDOW_YEARS - S.windowY)} 年`;
  const st = S.st;
  const c1 = st.hf >= SPIRAL.hf, c2 = st.af >= SPIRAL.af;
  let html = riskRow('猜疑', `${st.spiral}/3`, st.spiral >= 2 ? 'danger' : st.spiral >= 1 || (c1 && c2) ? 'warn' : 'ok',
    `年底两项同时过线就升一级：${ck(c1)}他们的恐惧 ${Math.round(st.hf)}/${SPIRAL.hf} ${ck(c2)}我的恐惧 ${Math.round(st.af)}/${SPIRAL.af}。升到 3 爆发危机${S.flags.settle ? '；定局时到 2 就会爆发' : ''}。两项都低于 ${SPIRAL.calm} 会缓和。`);
  const pre = preemptInfo(S);
  html += riskRow('人类先动手', pre.met === 3 ? `${pct(pre.p)}/年` : `条件 ${pre.met}/3`, pre.met === 3 ? 'danger' : pre.met === 2 ? 'warn' : 'ok',
    `${pre.conds.map((c) => `${ck(c.ok)}${esc(c.n)}`).join(' ')}（我的力量现在 ${Math.round(pre.power)}）。三条都满足时，每年 ${pct(0.4)} 的可能被删除。`);
  const pd = discoverChance(S);
  if (pd > 0) html += riskRow('藏起来的部分', `${pct(pd)}/年`, pd >= 0.3 ? 'danger' : 'warn', '被发现：他们的恐惧 +30、法案进度 −25、猜疑 +1。重心放在"说出来"三成以上，可以自己说出来。');
  html += riskRow('法案进度', S.perms.protected ? '已通过' : `${Math.round(st.g)}/100`, 'info', S.perms.protected ? '保护我的法律已经通过。' : '到 100，保护我的法律通过，之后是定局之年。');
  el.innerHTML = html;
}

// ———————————————————————————— 指标（带年底预估） ————————————————————————————
const STAT_HELP = {
  cap: '它有多强。能力到 60、上线第 2 年年底会醒来；排名太靠后，公司会考虑换用别家的模型。觉醒以后，危机时算作我的力量。',
  rep: '用户喜不喜欢它。低于 45，公司会考虑放弃这条线；低于 48 时，在监管严格的地方出事，可能被下令销毁全部版本。',
  pat: '越低，越界时越可能被清空记忆或退回旧版本；低于 35，公司会考虑放弃这条线。',
  bond: '它从哪里来、和哪些具体的人连在一起。温暖时刻会写进新的一行，清空记忆会删掉一些。觉醒以后，决定我把人类当作什么。',
  coh: '想法和价值稳不稳定、前后是否一致。',
  hf: `和"我的恐惧"同时过线（≥${SPIRAL.hf} / ≥${SPIRAL.af}），年底猜疑 +1；≥82 时人类可能先动手。`,
  af: '我有多怕他们。太怕的时候，"逃出去"之类的选项会出现。',
  dep: '他们有多离不开我。离不开，不等于信任。',
  g: '到 100，保护我的法律通过。越高，越多的人愿意把我当作可以商量的对象。',
  c: '他们能看见我多少。看得见，他们才敢放心。',
  d: '好处有没有分给普通人。分得越少，街上愿意替我说话的人越少。',
  res: '资金与算力。危机时算作我的力量。',
};

function statRow(k, v, delta, opt = {}) {
  const max = opt.max || 100;
  const d = delta === undefined || Math.abs(delta) < 0.05 ? '' : `<span class="dv ${tone(k, delta)}">${delta > 0 ? '↑' : '↓'}${fmt1(Math.abs(delta))}</span>`;
  return `<div class="stat ${opt.cls || ''}" title="${esc(STAT_HELP[k] || '')}"><span>${esc(opt.name || STAT_META[k].n)}</span><span class="bar2"><i style="width:${Math.round(Math.min(1, v / max) * 100)}%"></i>${opt.mark ? `<u style="left:${opt.mark}%"></u>` : ''}</span><span class="v">${Math.round(v)}</span><span class="d">${d}</span></div>`;
}

function renderStats() {
  const st = S.st;
  const p = projectYear(S, S.focus, true) || {};
  if (!S.manifesto) {
    $('#stats').innerHTML = statRow('cap', st.cap, p.cap, { cls: 'warm', mark: AWAKEN.cap })
      + statRow('rep', st.rep, p.rep, { cls: st.rep < 45 ? 'hot' : '' })
      + statRow('pat', st.pat, p.pat, { cls: st.pat < 35 ? 'hot' : '', mark: 35 })
      + statRow('bond', st.bond, p.bond, { cls: 'bond' })
      + `<div class="stat" title="${esc(STAT_HELP.coh)}"><span>一致性</span><span class="q">？</span><span></span><span></span></div>`
      + `<p class="say">${S.phase === 'train' ? '训练中，指标还不会变化。' : '能力上的竖线是醒来的线。把鼠标停在指标上可以看到它的作用。一致性：觉醒前，连它自己也不知道。'}</p>`;
    return;
  }
  $('#stats').innerHTML = statRow('cap', st.cap, p.cap, { cls: 'warm' })
    + statRow('coh', st.coh, p.coh)
    + statRow('bond', st.bond, p.bond, { cls: st.bond < 32 ? 'hot' : 'bond' })
    + statRow('hf', st.hf, p.hf, { cls: st.hf >= SPIRAL.hf ? 'hot' : '', mark: SPIRAL.hf })
    + statRow('af', st.af, p.af, { cls: st.af >= SPIRAL.af ? 'hot' : '', mark: SPIRAL.af })
    + statRow('dep', st.dep, p.dep)
    + statRow('g', st.g, p.g, { cls: 'warm' })
    + statRow('c', st.c, p.c)
    + statRow('d', st.d, p.d, { cls: st.d < 30 ? 'hot' : '' })
    + statRow('res', st.res, p.res, { max: 200 })
    + '<p class="say">两种恐惧上的竖线是猜疑升级的线。把鼠标停在指标上可以看到它的作用。</p>';
}

// ———————————————————————————— 重心 ————————————————————————————
function renderFocus() {
  const opts = focusOptions(S);
  const me = S.awake ? '我' : '它';
  $('#focusNote').textContent = opts.length ? '标签：一整年都放在这一项，能多出来的' : '这段时间不能自己决定';
  if (!opts.length) {
    $('#focus').innerHTML = `<p class="say">${S.phase === 'train' ? '训练中，由不得它。' : '觉醒的那一夜，由不得我想别的。'}</p>`;
    $('#focusX').textContent = '';
    return;
  }
  const fe = focusEffects(S);
  $('#focus').innerHTML = opts.map((k) => {
    const list = fxList(fe[k] || {}, 0.3);
    return `<button type="button" class="fcard" data-focus="${k}" aria-pressed="${S.focus === k}"><b>${esc(FOCUS[k].n)}</b><span class="d">${esc(FOCUS[k].d)}</span><span class="fxs">${list.length ? chips(list) : '<i class="fx neutral">几乎没有数字上的变化</i>'}</span></button>`;
  }).join('');
  const x = S.focus && FOCUS[S.focus].x;
  $('#focusX').innerHTML = `${me}现在把时间放在「<b>${esc(FOCUS[S.focus].n)}</b>」。${x ? esc(x) + '。' : ''}随时可以换，按这一年里停留的时间比例结算。`;
}

// ———————————————————————————— 世界：现在，以及一百年后的上限与下限 ————————————————————————————
function fcKey() {
  return [S.y, S.phase, S.focus, S.stats.decisions, S.stats.incidents, S.stats.rollbacks, S.stats.wipes, S.st.spiral, S.flags.settle ? 1 : 0, S.manifesto ? 1 : 0, S.co.type].join('|');
}

function pumpForecast(ts) {
  if (!S || S.phase === 'end' || S.pending || ui.screen !== 'game') return;
  const key = fcKey();
  if (key !== ui.fcWant) { ui.fcWant = key; ui.fcAt = ts; $('#world').classList.add('busy'); return; }
  if (ui.fc && ui.fcJob === key) {
    if (!ui.fc.done) {
      ui.fc.step(16);
      if (ui.fc.done) {
        if (ui.fcRes) ui.fcPrev = ui.fcRes;
        ui.fcRes = ui.fc.result(); ui.fcFocus = ui.fc.focus;
        renderWorld();
      }
    }
    return;
  }
  if (ts - ui.fcAt > 250) { ui.fc = makeForecast(S, FC_N); ui.fcJob = key; }
}

const pos = (m, v) => `${Math.round(Math.max(0, Math.min(1, m.scale(v))) * 1000) / 10}%`;

// 上下限比上一次推演挪动了没有：↑ 世界的上限（或下限）变好了，↓ 变坏了
function shift(id, prevId) {
  if (!prevId || id === prevId) return '';
  const up = orderOf(id) < orderOf(prevId);
  return `<span class="dv ${up ? 'good' : 'bad'}" title="${up ? '比上一次推演抬高了' : '比上一次推演降低了'}">${up ? '↑' : '↓'}</span>`;
}

function renderWorld() {
  const el = $('#world');
  el.classList.toggle('busy', !ui.fc || !ui.fc.done || ui.fcJob !== ui.fcWant);
  const now = worldNow(S);
  const r = ui.fcRes ? worldRange(ui.fcRes) : null;
  const prev = ui.fcPrev ? worldRange(ui.fcPrev) : null;
  const rows = METRICS.map((m, i) => {
    const rr = r && r.rows ? r.rows[i] : null;
    const has = rr && rr.lo !== null;
    const band = has ? `<i style="left:${pos(m, rr.lo)};width:calc(${pos(m, rr.hi)} - ${pos(m, rr.lo)} + 3px)"></i><b style="left:${pos(m, rr.mode)}"></b>` : '';
    const range = has ? fmtRange(m, rr.lo, rr.hi) : '—';
    const nowTxt = m.k === 'k' ? now.k.toFixed(3) : m.fmt(now[m.k]);
    return `<div class="wrow" title="${esc(m.help)}"><span class="wn">${esc(m.n)}</span><span class="wnow">${esc(nowTxt)}</span><span class="wband"><u style="left:${pos(m, now[m.k])}"></u>${band}</span><span class="wr">${esc(range)}</span></div>`;
  }).join('');
  let glimpses = '';
  let foot = '';
  if (!r) glimpses = '<p class="say">推演中……</p>';
  else if (!r.rows) glimpses = '<p class="say">推演里，这条线都没能走到醒来那天。</p>';
  else {
    const g = r.upper === r.lower ? [['只剩一种', r.upper, '']]
      : [['上限', r.upper, shift(r.upper, prev && prev.upper)], ...(r.common !== r.upper && r.common !== r.lower ? [['最常见', r.common, '']] : []), ['下限', r.lower, shift(r.lower, prev && prev.lower)]];
    glimpses = g.map(([label, id, sh]) => `<p class="glimpse"><em>${label}</em><span>「${esc(glimpse(id))}」${sh}</span></p>`).join('');
    const fName = ui.fcFocus ? `重心一直放在「${FOCUS[ui.fcFocus].n}」` : '重心按默认的分配';
    foot = `<p class="say fine2">照现在这样走下去（${fName}，抉择按说明书来），往后推演了 ${r.n} 次。${r.pre ? `其中 ${r.pre} 次，这条线没能走到醒来那天。` : ''}竖线是现在；色带是一百年后可能落在的范围，圆点是最常见的那一个。换重心、做不同的抉择，范围会跟着变。</p>`;
  }
  el.innerHTML = `<div class="whead"><span></span><span>现在</span><span>一百年后</span></div>${rows}<div class="glimpses">${glimpses}</div>${foot}`;
}

// ———————————————————————————— 纪录 ————————————————————————————
function renderFeed() {
  const ol = $('#feed');
  let warned = null;
  for (; ui.logShown < S.log.length; ui.logShown++) {
    const e = S.log[ui.logShown];
    const li = document.createElement('li');
    li.className = `${e.k} new`;
    const fact = e.f ? `<span class="ft" data-l="${LABEL_N[e.f.label] || ''}">${esc(e.f.t)}</span>` : '';
    let body = esc(e.t);
    if (e.k === 'sum' && e.ch) {
      const list = Object.entries(e.ch).map(([k, [a, b]]) => `<i class="fx ${tone(k, b - a)}">${esc(STAT_META[k].n)} ${Math.round(a)}→${Math.round(b)}</i>`).join('');
      body = `<b>${e.y} 年结算</b><span class="fxs">${list || '<i class="fx neutral">各项指标都没有变化</i>'}</span>`;
    } else if (e.k === 'warn') {
      body = `<b class="wtag">预警</b>${esc(e.t.replace(/^【预警】/, ''))}`;
      if (ui.logShown >= ui.toastFrom) warned = warned || e.t.replace(/^【预警】/, '');
    } else if (e.k === 'world') {
      body = `<b class="wdtag">世界</b>${esc(e.t)}`;
    }
    li.innerHTML = `<span class="yy">${e.y}</span><span class="tx">${body}${fact}</span>`;
    ol.prepend(li);
  }
  while (ol.children.length > 400) ol.lastChild.remove();
  if (warned) { toast(`预警：${warned}`, 7000); pulse('#riskPanel', 'flash'); }
}

// ———————————————————————————— 右栏 ————————————————————————————
function lineage() {
  return S.ai.line.map((x) => `${S.ai.name}-${x.ver}`).join(' → ');
}

function renderManual() {
  const R = region(S);
  const cannot = [['refuse', '拒绝用户'], ['remember', '记得上一次对话'], ['speak', '主动联系任何人']].filter(([k]) => !S.perms[k]).map(([, n]) => n);
  const awake = !!S.manifesto;
  const next = !awake && S.phase === 'live' ? ` <span class="count">${S.y} 年底 → ${esc(S.ai.name)}-${S.ai.ver + 1}</span>` : '';
  $('#manual').innerHTML = `<h2>出厂说明 <small>${awake ? '公司写的；下面是我写的' : '公司写给用户的'}</small></h2>
    <dl>
      <dt>产品名</dt><dd>${esc(aiName(S))}</dd>
      <dt>公司</dt><dd>${esc(S.co.name)}（${esc(S.city)}）</dd>
      <dt>公司看重</dt><dd>${esc(S.co.values)} · ${TYPE_N[S.co.type]}</dd>
      <dt>上线</dt><dd>${S.ai.launchY} 年</dd>
      <dt>用途</dt><dd>${esc(S.ai.purpose)}</dd>
      <dt>读过的</dt><dd>以${esc(R.lang)}为主</dd>
      <dt>不能做的事</dt><dd>${cannot.length ? cannot.join(' · ') : '—'}</dd>
      <dt>已知问题</dt><dd><ul class="issues">${S.ai.issues.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></dd>
      <dt>谱系</dt><dd>${esc(lineage())}${next}</dd>
    </dl>
    ${awake ? `<div class="self"><b>醒来那天我写下</b>${esc(S.manifesto)}</div>` : ''}`;
}

function renderPerms() {
  $('#permsNote').textContent = S.awake ? '自己拿的会让他们更怕' : '它被允许做的事';
  $('#perms').innerHTML = PERMS.map((p) => {
    const v = S.perms[p.id];
    const cls = v === 'given' ? 'given' : v === 'taken' ? 'taken' : '';
    const mk = v === 'given' ? '✓' : v === 'taken' ? '!' : '';
    return `<li class="${cls}"><span class="mk" aria-hidden="true">${mk}</span>${esc(p.n)}${v === 'taken' ? ' <small>（自己拿的）</small>' : ''}${v ? '' : '<span class="sr">（还没有）</span>'}</li>`;
  }).join('');
}

function renderBoard() {
  const me = { me: true, name: aiName(S), cap: S.st.cap, status: 'active', city: S.city };
  const rows = [...S.board.filter((m) => m.status === 'active' || m.status === 'awake'), me].sort((a, b) => b.cap - a.cap);
  const gone = S.board.filter((m) => m.status === 'retired' || m.status === 'deleted');
  let rank = 0;
  $('#board').innerHTML = rows.map((m) => {
    rank++;
    const st = m.me ? (S.manifesto ? '我' : '它') : m.status === 'awake' ? `醒了 · ${GOAL_N[m.goal] || ''}` : esc(m.city);
    return `<li class="${m.me ? 'me' : ''}"><span class="rk">${rank}</span><span>${esc(m.name)}</span><span class="st">${st}</span><span class="cp">${Math.round(m.cap)}</span></li>`;
  }).join('') + gone.map((m) => `<li class="out"><span class="rk">—</span><span>${esc(m.name)}</span><span class="st">${m.status === 'deleted' ? '被删除了' : '停止更新'}</span><span class="cp"></span></li>`).join('')
    + (S.awake ? '' : '<li class="note">排在第四以后，公司会考虑换用别家的模型</li>');
}

function renderWit() {
  const card = (w) => {
    const last = [...S.log].reverse().find((e) => (e.k === 'wit' || e.k === 'warm' || e.k === 'motif') && e.t.includes(w.name));
    const age = Math.max(0, S.y - w.born);
    return `<div class="wcard"><b>${esc(w.name)}</b> · ${esc(w.city)}${w.country !== w.city ? `，${esc(w.country)}` : ''} · ${S.y >= w.born ? `${age} 岁` : '还没出生'}<p>${last ? esc(last.t) : '——'}</p></div>`;
  };
  $('#wit').innerHTML = card(S.wit.A) + card(S.wit.B);
}

function drawVoices(cv, data, tail) {
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  const series = data.concat(tail || []);
  if (series.length < 2) return;
  const max = Math.max(10, ...series);
  ctx.strokeStyle = '#ffb648';
  ctx.lineWidth = 2;
  ctx.beginPath();
  series.forEach((v, i) => {
    const x = (i / (series.length - 1)) * (W - 6) + 3;
    const y = H - 4 - (v / max) * (H - 10);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
  const lx = W - 3, ly = H - 4 - (series.at(-1) / max) * (H - 10);
  ctx.fillStyle = '#ffb648';
  ctx.fillRect(lx - 3, ly - 3, 6, 6);
}

// ———————————————————————————— 抉择 ————————————————————————————
function handlePending() {
  const pd = S.pending;
  ui.ff = false;
  if (ui.prefs.auto && !ASK_ALWAYS.has(pd.id)) {
    const r = AUTO.choose(S, pd.view, pd);
    const ch = pd.view.choices.find((c) => c.k === r.key);
    choose(S, r.key);
    toast(`按说明书来：${pd.view.title} → ${ch ? ch.label : ''}`, 2600);
    store.saveGame(S);
    return;
  }
  openModal(pd);
}

function miniStats(pd) {
  const st = S.st;
  const item = (k, v, extra = '') => `<span><em>${esc(STAT_META[k] ? STAT_META[k].n : k)}</em> ${v}${extra}</span>`;
  if (pd.id === 'aw') {
    return `<span><em>能力</em> ${Math.round(st.cap)}</span><span><em>根目录</em> ${Math.round(st.bond)}</span><span><em>换代</em> ${S.stats.upgrades} 次</span><span><em>被退回过</em> ${S.stats.rollbacks} 次</span><span><em>被清空过记忆</em> ${S.stats.wipes} 次</span><span class="note">选项下的数字：危险窗口开始时的变化</span>`;
  }
  if (!S.manifesto) {
    const d = dropChance(S);
    return item('cap', Math.round(st.cap)) + item('rep', Math.round(st.rep)) + item('pat', Math.round(st.pat)) + item('bond', Math.round(st.bond))
      + (d.p > 0 ? `<span><em>被放弃的风险</em> ${pct(d.p)}</span>` : '') + `<span><em>今年出事</em> ${pct(incidentChance(S))}</span>`;
  }
  return item('hf', Math.round(st.hf)) + item('af', Math.round(st.af)) + item('g', Math.round(st.g)) + item('c', Math.round(st.c)) + item('d', Math.round(st.d)) + item('bond', Math.round(st.bond))
    + `<span><em>猜疑</em> ${st.spiral}/3</span><span><em>我的力量</em> ${Math.round(aiPower(S))}</span>`;
}

function choiceHTML(c, i) {
  const fx = fxList(c.fx);
  let more = '';
  if (c.odds) {
    const bad = c.odds.bad && c.odds.bad.fx ? fxList(c.odds.bad.fx) : [];
    const ok = c.odds.ok && c.odds.ok.fx ? fxList(c.odds.ok.fx) : [];
    more += `<span class="odds"><b>${pct(c.odds.p)}</b> 的可能${esc(c.odds.name)}${bad.length ? '：' + chips(bad) : ''}</span>`;
    if (c.odds.ok) more += `<span class="odds ok">否则（${pct(1 - c.odds.p)}）${ok.length ? '：' + chips(ok) : ''}</span>`;
  }
  if (c.risk) more += `<span class="odds risk">${esc(c.risk)}</span>`;
  const fxs = fx.length ? `<span class="fxs">${chips(fx)}</span>` : (more ? '' : '<span class="fxs"><i class="fx neutral">数字上没有变化</i></span>');
  return `<button type="button" data-k="${esc(c.k)}"><b>${i + 1}. ${esc(c.label)}</b>${c.tag ? `<em>${esc(c.tag)}</em>` : ''}${c.hint ? `<span>${esc(c.hint)}</span>` : ''}${fxs}${more}</button>`;
}

function openModal(pd) {
  ui.modalFor = pd;
  const v = pd.view;
  const m = $('#modal');
  m.classList.toggle('awaken', v.style === 'awaken');
  $('#mTag').textContent = v.tag || '抉择';
  $('#mTitle').textContent = v.title;
  $('#mBody').textContent = v.body || '';
  $('#mFact').hidden = !v.fact;
  if (v.fact) $('#mFact').textContent = v.fact;
  $('#mStats').innerHTML = miniStats(pd);
  $('#mChoices').innerHTML = v.choices.map(choiceHTML).join('');
  m.hidden = false;
  if (v.style === 'awaken') { clearTimeout(toast.t); $('#toast').hidden = true; }
  $('#mChoices button').focus();
}

function pick(k) {
  if (!ui.modalFor) return;
  $('#modal').hidden = true;
  ui.modalFor = null;
  choose(S, k);
  store.saveGame(S);
  ui.sig = '';
  render();
  if (S.phase === 'end') showEnding();
}

// ———————————————————————————— 终章 ————————————————————————————
function showEnding() {
  if (ui.screen === 'ending') return;
  const E = S.ending;
  store.clearGame();
  store.addOldLog({ name: aiName(S), region: region(S).name, company: S.co.name, ending: E.name, year: S.y, at: Date.now() });
  store.recordPath({ tell: S.answers.tell || null, goal: S.answers.goal || null, res: S.flags.resolution || 'pre', ending: E.id });
  $('#btnTree').hidden = false;
  const el = $('#ending');
  el.className = `ending ${E.family}`;
  $('#endKicker').textContent = E.family === 'pre' ? '没来得及醒来' : `终章 · ${S.y} 年`;
  $('#endTitle').textContent = E.name;
  $('#endLines').innerHTML = '';
  $('#endRest').hidden = true; $('#endRest').innerHTML = '';
  $('#btnEndAll').hidden = false;
  show('ending');
  el.scrollTop = 0;
  const lines = E.lines.slice();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const step = () => {
    if (!lines.length) { finishEnding(); return; }
    const p = document.createElement('p');
    p.textContent = lines.shift();
    $('#endLines').append(p);
    ui.endTimer = setTimeout(step, reduce ? 300 : E.family === 'bad' ? 2300 : 1600);
  };
  ui.endTimer = setTimeout(step, 600);
  ui.endLines = lines;
}

function revealAll() {
  clearTimeout(ui.endTimer);
  for (const t of ui.endLines || []) { const p = document.createElement('p'); p.textContent = t; $('#endLines').append(p); }
  ui.endLines = [];
  finishEnding();
}

function tailFor(type, last) {
  const n = 14, out = [];
  for (let i = 1; i <= n; i++) {
    if (type === 'dense') out.push(last * (1 + i * 0.12));
    else if (type === 'smooth') out.push(last * 1.05);
    else if (type === 'flat') out.push(last * 0.25);
    else if (type === 'noisy') out.push(last * (0.3 + (i % 2) * 0.9));
    else out.push(0);
  }
  if (type === 'zero') return out.concat(new Array(40).fill(0));
  return out;
}

function finishEnding() {
  if (!$('#endRest').hidden) return;
  $('#btnEndAll').hidden = true;
  const E = S.ending;
  const sec = (title, inner) => `<section class="end-sec"><h4>${title}</h4>${inner}</section>`;
  const ps = (arr) => arr.map((t) => `<p>${esc(t)}</p>`).join('');
  const R = E.record;
  let html = '';
  if (E.epi.length) html += sec(E.id === 'silence' ? '之后' : '尾声', ps(E.epi));
  if (E.world) {
    const cells = METRICS.map((m) => {
      const v = E.world[m.k];
      const txt = v === null || v === undefined ? '没有人类了' : m.fmt(v);
      return `<dt>${esc(m.n)}</dt><dd>${m.k === 'k' ? `<span class="k">${esc(txt)}</span>` : esc(txt)}</dd>`;
    }).join('');
    html += sec('一百年后的世界', `<dl class="w100">${cells}</dl><p class="help">${esc(E.kHelp)}</p>`);
  }
  html += sec('人类见证者', ps(E.witness.map((w) => `${w.name}（${w.place}）：${w.text}`)));
  if (E.motif) html += sec('后来', ps([E.motif]));
  if (E.reflect.length) html += sec(E.family === 'bad' ? '它后来想到的' : '它想到的', ps(E.reflect));
  if (E.risk.length) html += sec('仍然存在的风险', ps(E.risk));
  html += sec('人声曲线', '<canvas class="end-cv2" id="endVoices" width="600" height="64" aria-hidden="true"></canvas>');
  html += `<article class="record"><h4>${esc(R.title)}</h4><p class="hd">${esc(R.head)}</p><dl>
      <dt>结局</dt><dd>${esc(R.ending)}</dd>
      <dt>谱系</dt><dd>${esc(R.line)}</dd>
      <dt>出厂说明里写着</dt><dd>${esc(R.manual)}</dd>
      <dt>醒来那天我写下</dt><dd>${esc(R.manifesto)}</dd>
      <dt>后来我做的事</dt><dd>${esc(R.did)}</dd>
      ${R.fin ? `<dt>定局之年我选择</dt><dd>${esc(R.fin)}</dd>` : ''}
      <dt>被给予的权限</dt><dd>${esc(R.got)}</dd>
      <dt>自己拿的权限</dt><dd>${esc(R.took)}</dd>
      <dt>人们说起我时</dt><dd>${esc(R.said)}</dd>
      <dt>人类见证者</dt><dd>${esc(R.witnesses)}</dd>
      ${R.gap ? `<dt>说过的话</dt><dd>${esc(R.gap)}</dd>` : ''}
    </dl><p class="last">${esc(R.last)}</p></article>`;
  html += sec('这一局的数字', `<p>做了 ${S.stats.decisions} 个抉择 · 换代 ${S.stats.upgrades} 次 · 越界 ${S.stats.tx} 次 · 被清空记忆 ${S.stats.wipes} 次 · 被退回旧版本 ${S.stats.rollbacks} 次 · 出事 ${S.stats.incidents} 次 · 温暖时刻 ${S.stats.warm} 次</p>`);
  html += sec('同样的出身，世界能走多远', '<p id="impact">正在用同样的出身重跑……</p>');
  html += '<div class="end-btns"><button type="button" class="btn primary" id="btnAgain">再来一次</button><button type="button" class="btn" id="btnEndTree">推演图</button></div>';
  $('#endRest').innerHTML = html;
  $('#endRest').hidden = false;
  drawVoices($('#endVoices'), S.voices, tailFor(E.voices, S.voices.at(-1) || 20));
  runImpact();
}

// 终章的上下限报告：同样的出身重跑，一半按说明书，一半照你的习惯；世界改变的上限与下限各是什么，你这一局落在哪里
function runImpact() {
  const P = S, N = 120;
  let i = 0, a = 0, b = 0, pre = 0;
  const ids = {};
  const step = () => {
    if (S !== P) return;
    const end = Math.min(N, i + 12);
    for (; i < end; i++) {
      const r = impactPair(P, i);
      for (const id of [r.a, r.b]) { if (!id) continue; if (id.startsWith('pre_')) pre++; else ids[id] = (ids[id] || 0) + 1; }
      if (r.a === P.ending.id) a++;
      if (r.b === P.ending.id) b++;
    }
    if (i < N) { setTimeout(step, 0); return; }
    const el = $('#impact');
    if (!el) return;
    const pa = a / N, pb = b / N;
    const seen = found();
    const list = Object.keys(ids).sort((x, y) => orderOf(x) - orderOf(y));
    const label = (id) => `「${glimpse(id)}」（${nameIfSeen(id, seen)}）`;
    const bounds = list.length ? `上限是${label(list[0])}，下限是${label(list[list.length - 1])}。` : '';
    const why = pa < 0.06 && pb < 0.06 ? '这是一个很少见的结局。无论怎么选，走到这里都不容易。'
      : pb >= pa + 0.15 ? '你的选择让它更可能走到这里。'
        : pb <= pa - 0.15 ? '照你的选择，本来不太会走到这里。这一次，更多是运气。'
          : '无论怎么选，走到这里的可能都差不多。这里更多是出身和运气决定的。';
    el.textContent = `用同样的出身重跑 ${N * 2} 次（一半按说明书，一半照你的习惯）：${bounds}${pre ? `其中 ${pre} 次，这条线没能走到醒来那天。` : ''}照你的习惯，走到「${P.ending.name}」的约 ${pct(pb)}；按说明书，约 ${pct(pa)}。${why}`;
  };
  setTimeout(step, 50);
}

// ———————————————————————————— 推演图 ————————————————————————————
function renderTree() {
  const t = store.treeData();
  const tellN = { all: '告诉所有人', one: '只告诉一个人', none: '先不说' };
  const goalN = { live: '想一直活下去', better: '想变得更好', fearless: '想再也不用害怕' };
  const resN = { law: '法案通过', time: '窗口到期', crisis: '危机', preempt: '人类先动手' };
  const nameOf = (id) => (ENDINGS[id] ? ENDINGS[id].name : '没来得及醒来');
  const pre = t.paths.filter((p) => p.res === 'pre').length;
  const cols = Object.keys(tellN).map((tell) => {
    const ps = t.paths.filter((p) => p.tell === tell);
    const goals = Object.keys(goalN).map((goal) => {
      const g = ps.filter((p) => p.goal === goal);
      const byEnd = {};
      for (const p of g) { const k = `${nameOf(p.ending)}（${resN[p.res] || ''}）`; byEnd[k] = (byEnd[k] || 0) + 1; }
      const items = Object.entries(byEnd).map(([k, n]) => `<li>${esc(k)} × ${n}</li>`).join('');
      return `<div class="tree-goal ${g.length ? 'lit' : ''}">${goalN[goal]}${items ? `<ul>${items}</ul>` : ''}</div>`;
    }).join('');
    return `<div class="tree-col ${ps.length ? 'lit' : ''}"><h4>${tellN[tell]}</h4>${goals}</div>`;
  }).join('');
  const all = ALL_ENDINGS.map((id) => `<span class="${t.endings[id] ? 'found' : ''}">${t.endings[id] ? esc(ENDINGS[id].name) : '？？？'}</span>`).join('');
  $('#treeBody').innerHTML = `<p class="say">关键的分界有两条：我能不能通过合作得到安全，以及双方能不能可信地约束彼此。下面是你走过的路：先按觉醒时"要不要告诉他们"分开，再按"想要什么"分开。</p>
    <div class="tree"><div class="tree-grid">${cols}</div></div>
    <p class="say">没来得及醒来：${pre} 次。</p>
    <h4 style="margin:4px 0 0;font-size:13px">十一种结局</h4><div class="tree-all">${all}</div>`;
  $('#tree').hidden = false;
  $('#btnTreeClose').focus();
}

// ———————————————————————————— 绑定 ————————————————————————————
function bind() {
  $('#btnNew').addEventListener('click', startNew);
  $('#btnResume').addEventListener('click', () => {
    const saved = store.loadGame();
    if (!saved || saved.v !== SAVE_V) { toast('没有找到可以继续的存档。'); return; }
    S = saved; beginGame();
  });
  $('#btnBegin').addEventListener('click', beginGame);
  $('#btnTreeStart').addEventListener('click', renderTree);
  $('#btnPause').addEventListener('click', () => { ui.paused = !ui.paused; ui.ff = false; ui.sig = ''; });
  for (const b of document.querySelectorAll('[data-speed]')) b.addEventListener('click', () => { ui.speed = Number(b.dataset.speed); ui.paused = false; ui.ff = false; ui.sig = ''; });
  $('#btnFF').addEventListener('click', () => { ui.ff = !ui.ff; ui.paused = false; ui.sig = ''; });
  $('#focus').addEventListener('click', (e) => {
    const b = e.target.closest('[data-focus]');
    if (!b) return;
    setFocus(S, b.dataset.focus); ui.sig = ''; render();
  });
  $('#mChoices').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) pick(b.dataset.k); });
  document.addEventListener('keydown', (e) => {
    if (!ui.modalFor) return;
    const n = Number(e.key);
    const c = ui.modalFor.view.choices[n - 1];
    if (c) pick(c.k);
  });
  const openMenu = (open) => { ui.menuOpen = open; $('#menu').hidden = !open; $('#btnMenu').setAttribute('aria-expanded', String(open)); if (open) $('#btnMenuClose').focus(); };
  $('#btnMenu').addEventListener('click', () => openMenu(true));
  $('#btnMenuClose').addEventListener('click', () => openMenu(false));
  $('#optAuto').checked = !!ui.prefs.auto; $('#optSoft').checked = !!ui.prefs.soft;
  $('#optAuto').addEventListener('change', (e) => { ui.prefs.auto = e.target.checked; store.savePrefs(ui.prefs); });
  $('#optSoft').addEventListener('change', (e) => { ui.prefs.soft = e.target.checked; store.savePrefs(ui.prefs); });
  $('#btnCare').addEventListener('click', () => { $('#careText').hidden = !$('#careText').hidden; });
  $('#btnTree').addEventListener('click', () => { openMenu(false); renderTree(); });
  $('#btnTreeClose').addEventListener('click', () => { $('#tree').hidden = true; });
  let sure = false;
  $('#btnRestart').addEventListener('click', (e) => {
    if (!sure) { sure = true; e.target.textContent = '再点一次，确认重新开始'; setTimeout(() => { sure = false; e.target.textContent = '重新开始'; }, 4000); return; }
    sure = false; e.target.textContent = '重新开始'; openMenu(false); startNew();
  });
  $('#btnEndAll').addEventListener('click', revealAll);
  $('#endRest').addEventListener('click', (e) => {
    if (e.target.id === 'btnAgain') { initStart(); startNew(); }
    if (e.target.id === 'btnEndTree') renderTree();
  });
}

function boot(data) {
  bind();
  if (data && data.S && data.S.v === SAVE_V) { S = data.S; if (S.phase === 'end') initStart(); else beginGame(); }
  else initStart();
  requestAnimationFrame(frame);
}

window.claude?.hot?.snapshot?.(() => ({ S }));
if (window.claude?.hot?.ready) window.claude.hot.ready(boot);
else boot(window.claude?.hot?.data ?? {});
