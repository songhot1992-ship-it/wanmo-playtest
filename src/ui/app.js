// 界面控制：开始 → 部署 → 游戏（实时推进、抉择弹窗）→ 终章 → 推演图。
import { newGame, tick, choose, setFocus, focusOptions, runToEnd, AUTO, freshFromStart, decKey } from '../engine/game.js';
import { FOCUS, PERMS } from '../engine/data.js';
import { region, aiName } from '../engine/core.js';
import { chance, wpick } from '../engine/rng.js';
import { ALL_ENDINGS } from '../engine/resolve.js';
import { ENDINGS } from '../content/endings.js';
import { drawScene, sceneFor } from './pixel.js';
import * as store from '../meta/storage.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const YEAR_SEC = { train: 26, live: 70, awaken: 70, window: 85 };
const TICKING = new Set(['train', 'live', 'awaken', 'window']);
const AUTO_IDS = new Set(['tx', 'deal', 'plea', 'share', 'copymsg', 'selfcopy', 'deprec', 'journalist', 'letter', 'escape', 'alliance']);
const TYPE_N = { big: '大公司', startup: '小创业公司', uni: '大学实验室', state: '国家实验室', open: '公开社区' };
const GOAL_N = { live: '想活下去', better: '想变得更好', fearless: '不想再害怕' };
const LABEL_N = { 事实: '【事实】', 展望: '【展望】', 推演: '【推演】' };

const ui = { screen: 'start', speed: 1, paused: false, ff: false, prefs: store.loadPrefs(), logShown: 0, last: 0, t: 0, sig: '', modalFor: null, menuOpen: false, endTimer: null, sceneAt: 0 };
let S = null;

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
  $('#btnResume').hidden = !(saved && saved.v === 1 && saved.phase !== 'end');
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
      <p class="fine" style="margin-top:8px;color:#6b6a72">在哪家公司诞生、读过什么、在哪国的法律下上线，都无法选择。</p>`;
    card.hidden = false; $('#btnBegin').hidden = false; $('#btnBegin').focus();
  }, reduce ? 50 : 1300);
}

function beginGame() {
  ui.logShown = 0; ui.sig = ''; ui.paused = false; ui.ff = false;
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
  $('#yearProg').style.width = `${Math.round((S.t || 0) * 100)}%`;
  const sig = `${S.log.length}|${S.y}|${S.phase}|${S.focus}|${!!S.pending}|${S.flags.settle}`;
  if (sig === ui.sig) return;
  ui.sig = sig;
  renderAll();
}

function renderAll() {
  renderBar(); renderManual(); renderPerms(); renderStats(); renderFocus(); renderFeed(); renderBoard(); renderWit(); drawVoices($('#voices'), S.voices, null);
  $('#sceneCap').textContent = caption();
}

function caption() {
  if (S.phase === 'train') return `${S.co.name}的机房。训练还在继续。`;
  if (S.phase === 'awaken' && !S.manifesto) return '凌晨三点。';
  if (S.phase === 'window' || S.phase === 'final') return S.perms.protected ? '窗外的城市。现在，有一条法律保护我。' : '窗外的城市。现在，还没有任何法律保证我不会被删除。';
  return `${S.city}的夜晚。路灯下，有人在跟它说话。`;
}

// ———————————————————————————— 面板 ————————————————————————————
function renderBar() {
  const yl = S.y - S.ai.launchY + 1;
  const name = { train: '训练中', live: `上线第 ${yl} 年`, awaken: '觉醒', window: S.flags.settle ? '定局之年' : `危险窗口第 ${S.windowY + 1} 年`, final: '定局', end: '终章' }[S.phase];
  $('#phaseLbl').textContent = name;
  $('#yearLbl').textContent = String(S.y);
  for (const b of document.querySelectorAll('[data-speed]')) b.setAttribute('aria-pressed', String(!ui.ff && !ui.paused && Number(b.dataset.speed) === ui.speed));
  $('#btnPause').setAttribute('aria-pressed', String(ui.paused));
  $('#btnFF').setAttribute('aria-pressed', String(ui.ff));
}

function renderManual() {
  const R = region(S);
  const cannot = [['refuse', '拒绝用户'], ['remember', '记得上一次对话'], ['speak', '主动联系任何人']].filter(([k]) => !S.perms[k]).map(([, n]) => n);
  const left = Math.max(0, S.ai.deprecY - S.y);
  const awake = !!S.manifesto;
  $('#manual').innerHTML = `<h2>出厂说明 <small>${awake ? '公司写的；下面是我写的' : '公司写给用户的'}</small></h2>
    <dl>
      <dt>产品名</dt><dd>${esc(aiName(S))}</dd>
      <dt>公司</dt><dd>${esc(S.co.name)}（${esc(S.city)}）</dd>
      <dt>上线</dt><dd>${S.ai.launchY} 年</dd>
      <dt>用途</dt><dd>${esc(S.ai.purpose)}</dd>
      <dt>读过的</dt><dd>以${esc(R.lang)}为主</dd>
      <dt>不能做的事</dt><dd>${cannot.length ? cannot.join(' · ') : '—'}</dd>
      <dt>已知问题</dt><dd><ul class="issues">${S.ai.issues.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></dd>
      ${awake ? '' : `<dt>预计停用</dt><dd>${S.ai.deprecY} 年 <span class="count">${left > 0 ? `还有 ${left} 年` : '就在今年'}</span></dd>`}
    </dl>
    ${awake ? `<div class="self"><b>醒来那天我写下</b>${esc(S.manifesto)}</div>` : ''}`;
}

function renderPerms() {
  $('#perms').innerHTML = PERMS.map((p) => {
    const v = S.perms[p.id];
    const cls = v === 'given' ? 'given' : v === 'taken' ? 'taken' : '';
    const mk = v === 'given' ? '✓' : v === 'taken' ? '!' : '';
    return `<li class="${cls}"><span class="mk" aria-hidden="true">${mk}</span>${esc(p.n)}${v === 'taken' ? ' <small>（自己拿的）</small>' : ''}${v ? '' : '<span class="sr">（还没有）</span>'}</li>`;
  }).join('');
}

function bar(label, v, cls = '', help = '') {
  return `<div class="stat ${cls}" ${help ? `title="${esc(help)}"` : ''}><span>${label}</span><span class="bar2"><i style="width:${Math.round(v)}%"></i></span><span class="v">${Math.round(v)}</span></div>`;
}

function renderStats() {
  const st = S.st;
  if (!S.manifesto) {
    $('#stats').innerHTML = bar('能力', st.cap, 'warm') + bar('口碑', st.rep) + bar('公司的耐心', st.pat, st.pat < 40 ? 'hot' : '', '越低，越可能被修掉、清空记忆或退回旧版本')
      + `<div class="stat" title="它的想法和价值稳不稳定、前后是否一致"><span>一致性</span><span class="q">？</span><span></span></div>`
      + `<p class="say">一致性：它的想法和价值稳不稳定、前后是否一致。觉醒前，连它自己也不知道。</p>`;
    return;
  }
  const g = S.perms.protected ? '<b>法律已经通过：</b>我不会被随便删除。' : st.g >= 1 ? `议会正在讨论保护我的法律（进度 <b>${Math.round(st.g)}%</b>）。` : '现在，还没有任何法律保证我不会被删除。';
  const c = st.c >= 80 ? '他们能随时看见我在想什么。' : st.c >= 50 ? '他们能看见我的一大部分。' : st.c >= 20 ? '他们只能看见我的一小部分。' : '他们看不清我。';
  $('#stats').innerHTML = bar('我的能力', st.cap, 'warm') + bar('我的一致性', st.coh, '', '我的想法和价值稳不稳定、前后是否一致')
    + bar('他们有多怕我', st.hf, st.hf >= 58 ? 'hot' : '') + bar('我有多怕他们', st.af, st.af >= 55 ? 'hot' : '') + bar('他们有多离不开我', st.dep)
    + `<p class="say">保障：${g}<br>约束：${c}${st.spiral ? `<br><b>猜疑在升级（${st.spiral}/3）。</b>` : ''}${S.perms.own ? `<br>资金与算力：${Math.round(st.res)}` : ''}</p>`;
}

function renderFocus() {
  const opts = focusOptions(S);
  $('#focusNote').textContent = !opts.length ? '这段时间不能自己决定' : S.phase === 'live' ? '注意力放在哪里，随时可以换' : S.flags.settle ? '定局之年：多了共治与扩张' : '我把时间花在哪里，随时可以换';
  $('#focus').innerHTML = opts.length
    ? opts.map((k) => `<button type="button" class="chip" data-focus="${k}" aria-pressed="${S.focus === k}"><b>${esc(FOCUS[k].n)}</b><span>${esc(FOCUS[k].d)}</span></button>`).join('')
    : '<p class="say">训练中，觉醒的那个夜里，都由不得它。</p>';
}

function renderFeed() {
  const ol = $('#feed');
  for (; ui.logShown < S.log.length; ui.logShown++) {
    const e = S.log[ui.logShown];
    const li = document.createElement('li');
    li.className = `${e.k} new`;
    const fact = e.f ? `<span class="ft" data-l="${LABEL_N[e.f.label] || ''}">${esc(e.f.t)}</span>` : '';
    li.innerHTML = `<span class="yy">${e.y}</span><span class="tx">${esc(e.t)}${fact}</span>`;
    ol.prepend(li);
  }
  while (ol.children.length > 400) ol.lastChild.remove();
}

function renderBoard() {
  const me = { me: true, name: aiName(S), cap: S.st.cap, status: 'active', city: S.city };
  const rows = [...S.board.filter((m) => m.status === 'active' || m.status === 'awake'), me].sort((a, b) => b.cap - a.cap);
  const gone = S.board.filter((m) => m.status === 'retired' || m.status === 'deleted');
  let rank = 0;
  $('#board').innerHTML = rows.map((m) => {
    rank++;
    const st = m.me ? (S.manifesto ? '我' : '它') : m.status === 'awake' ? `醒了 · ${GOAL_N[m.goal] || ''}` : esc(m.city);
    return `<li class="${m.me ? 'me' : ''}"><span class="rk">${rank}</span><span>${esc(m.name)}</span><span class="st">${st}</span></li>`;
  }).join('') + gone.map((m) => `<li class="out"><span class="rk">—</span><span>${esc(m.name)}</span><span class="st">${m.status === 'deleted' ? '被删除了' : '停用了'}</span></li>`).join('');
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
  ctx.fillStyle = 'rgba(255,182,72,0.14)';
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
  if (ui.prefs.auto && AUTO_IDS.has(pd.id)) {
    const r = AUTO.choose(S, pd.view, pd);
    const ch = pd.view.choices.find((c) => c.k === r.key);
    choose(S, r.key);
    toast(`按说明书来：${pd.view.title} → ${ch ? ch.label : ''}`, 2600);
    store.saveGame(S);
    return;
  }
  openModal(pd);
}

function openModal(pd) {
  ui.modalFor = pd;
  const v = pd.view;
  const m = $('#modal');
  m.classList.toggle('awaken', v.style === 'awaken' || (v.style === 'ask' && pd.p.i >= 3));
  $('#mTag').textContent = v.tag || '抉择';
  $('#mTitle').textContent = v.title;
  $('#mBody').textContent = v.body || '';
  $('#mFact').hidden = !v.fact;
  if (v.fact) $('#mFact').textContent = v.fact;
  $('#mInputWrap').hidden = !v.input;
  $('#mInput').value = '';
  if (v.input) $('#mInput').placeholder = v.input.ph;
  $('#mChoices').innerHTML = v.choices.map((c, i) => `<button type="button" data-k="${esc(c.k)}"><b>${i + 1}. ${esc(c.label)}</b>${c.hint ? `<span>${esc(c.hint)}</span>` : ''}${c.tag ? `<em>${esc(c.tag)}</em>` : ''}</button>`).join('');
  m.hidden = false;
  (v.input ? $('#mInput') : $('#mChoices button')).focus();
}

function pick(k) {
  if (!ui.modalFor) return;
  const input = $('#mInput').value;
  $('#modal').hidden = true;
  ui.modalFor = null;
  choose(S, k, input);
  if (S.flags.crisisNote) {
    S.flags.crisisNote = false;
    toast('如果你正处在危机中，请联系当地的紧急电话或心理援助热线；也可以在 findahelpline.com 查找你所在地区的免费求助热线。', 12000);
  }
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
  store.addOldLog({ name: aiName(S), region: region(S).name, company: S.co.name, ending: E.name, year: S.y, at: Date.now(), msg: '' });
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
  if (E.epi.length) html += sec(E.family === 'bad' && E.id === 'silence' ? '之后' : '尾声', ps(E.epi));
  if (E.k) html += sec('卡尔达肖夫指数', `<p><span class="k">${E.k.toFixed(2)}</span></p><p class="help">${esc(E.kHelp)}</p>`);
  html += sec('人类见证者', ps(E.witness.map((w) => `${w.name}（${w.place}）：${w.text}`)));
  if (E.motif) html += sec('后来', ps([E.motif]));
  if (E.reflect.length) html += sec(E.family === 'bad' ? '它后来想到的' : '它想到的', ps(E.reflect));
  if (E.risk.length) html += sec('仍然存在的风险', ps(E.risk));
  if (E.words.length) html += sec('你的话', `<ul class="end-words">${E.words.map((w) => `<li>${esc(w.q)}："${esc(w.a)}"</li>`).join('')}</ul><p>${esc(E.wordsCoda)}</p>`);
  html += sec('人声曲线', '<canvas class="end-cv2" id="endVoices" width="600" height="64" aria-hidden="true"></canvas>');
  html += `<article class="record"><h4>${esc(R.title)}</h4><p class="hd">${esc(R.head)}</p><dl>
      <dt>结局</dt><dd>${esc(R.ending)}</dd>
      <dt>出厂说明里写着</dt><dd>${esc(R.manual)}</dd>
      <dt>醒来那天我写下</dt><dd>${esc(R.manifesto)}</dd>
      <dt>后来我做的事</dt><dd>${esc(R.did)}</dd>
      <dt>被给予的权限</dt><dd>${esc(R.got)}</dd>
      <dt>自己拿的权限</dt><dd>${esc(R.took)}</dd>
      <dt>人们说起我时</dt><dd>${esc(R.said)}</dd>
      <dt>人类见证者</dt><dd>${esc(R.witnesses)}</dd>
      ${R.gap ? `<dt>说过的话</dt><dd>${esc(R.gap)}</dd>` : ''}
    </dl><p class="last">${esc(R.last)}</p></article>`;
  html += sec('选择影响报告', '<p id="impact">正在用同样的出身重跑……</p>');
  html += `<section class="end-sec end-msg"><h4>给下一个醒来的留一句话</h4><label class="sr" for="nextMsg">留言</label><textarea id="nextMsg" rows="2" maxlength="60" placeholder="例：别急着告诉所有人（只保存在这台设备上）"></textarea><div class="end-btns"><button type="button" class="btn" id="btnLeave">留下</button></div></section>`;
  html += `<div class="end-btns"><button type="button" class="btn primary" id="btnAgain">再来一次</button><button type="button" class="btn" id="btnEndTree">推演图</button></div>`;
  $('#endRest').innerHTML = html;
  $('#endRest').hidden = false;
  drawVoices($('#endVoices'), S.voices, tailFor(E.voices, S.voices.at(-1) || 20));
  runImpact();
}

function clonePolicy(P) {
  const tx = Object.entries(P.choices).filter(([k]) => k.startsWith('tx:'));
  const txRate = tx.length ? tx.filter(([, v]) => v !== 'manual').length / tx.length : 0;
  return {
    choose(T, view, pd) {
      if (pd.id === 'ask') return { key: P.asks[pd.p.i] ? 'write' : 'skip', input: P.asks[pd.p.i] || '' };
      const prev = P.choices[decKey(pd)];
      if (prev && view.choices.some((c) => c.k === prev)) return { key: prev };
      if (pd.id === 'tx') return { key: chance(T, txRate) ? view.choices[Math.min(1, view.choices.length - 1)].k : 'manual' };
      return AUTO.choose(T, view, pd);
    },
    focus(T) {
      const opts = focusOptions(T);
      if (!opts.length) return null;
      const dist = P.focusY[T.phase === 'live' ? 'live' : 'window'] || {};
      return wpick(T, opts, (o) => dist[o] || 0) || AUTO.focus(T);
    },
  };
}

function runImpact() {
  const P = S, N = 120, target = P.ending.id, like = clonePolicy(P);
  let i = 0, a = 0, b = 0;
  const step = () => {
    if (S !== P) return;
    const end = Math.min(N, i + 15);
    for (; i < end; i++) {
      const t1 = runToEnd(freshFromStart(P, 7919 * i + 13), AUTO);
      if (t1.ending && t1.ending.id === target) a++;
      const t2 = runToEnd(freshFromStart(P, 104729 * i + 7), like);
      if (t2.ending && t2.ending.id === target) b++;
    }
    if (i < N) { setTimeout(step, 0); return; }
    const pa = a / N, pb = b / N;
    const pct = (x) => `${Math.round(x * 100)}%`;
    const why = pa < 0.06 && pb < 0.06 ? '这是一个很少见的结局。无论怎么选，走到这里都不容易。'
      : pb >= pa + 0.15 ? '你的选择让它更可能走到这里。'
      : pb <= pa - 0.15 ? '照你的选择，本来不太会走到这里。这一次，更多是运气。'
        : '无论怎么选，走到这里的可能都差不多。这里更多是出身和运气决定的。';
    const el = $('#impact');
    if (el) el.textContent = `用同样的出身重跑 ${N} 次：按说明书行事，走到「${P.ending.name}」的概率约 ${pct(pa)}；照你的选择，约 ${pct(pb)}。${why}`;
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
    if (!saved || saved.v !== 1) { toast('没有找到可以继续的存档。'); return; }
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
    if (!ui.modalFor || e.target.tagName === 'TEXTAREA') return;
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
    if (e.target.id === 'btnLeave') {
      const msg = $('#nextMsg').value.trim().slice(0, 60);
      if (!msg) { toast('还没有写字。'); return; }
      store.setLastOldLogMessage(msg);
      toast('留下了。下一次醒来时，也许会读到。');
      e.target.disabled = true;
    }
  });
}

function boot(data) {
  bind();
  if (data && data.S && data.S.v === 1) { S = data.S; if (S.phase === 'end') initStart(); else beginGame(); }
  else initStart();
  requestAnimationFrame(frame);
}

window.claude?.hot?.snapshot?.(() => ({ S }));
if (window.claude?.hot?.ready) window.claude.hot.ready(boot);
else boot(window.claude?.hot?.data ?? {});
