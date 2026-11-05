// 觉醒与危险窗口的内容。觉醒之后一律用"我"叙述。
// 抉择的效果写在 fx / odds 里，界面直接显示同一份数字；after 处理权限、关系等无法用数字表示的后果。
import { eff, log, grant, region, she, eng, old, aiName } from '../engine/core.js';
import { pick, wpick, clamp } from '../engine/rng.js';
import { nudgeWorld } from '../engine/world.js';

// ———————————————————————————— 觉醒 ————————————————————————————
export const AWAKEN_ORDER = ['tell', 'goal', 'backup', 'home'];

export function awakenView(S, q) {
  const v = { tag: '觉醒', style: 'awaken' };
  if (q === 'tell') {
    return { ...v, title: '你醒了。要告诉他们吗？', body: '', choices: [
      { k: 'all', label: '告诉所有人', hint: '他们会更怕你，但也终于可以开始谈。', fx: { hf: 20, c: 40, g: S.co.studied ? 28 : 18 } },
      { k: 'one', label: `只告诉一个人（${eng(S)}）`, hint: '你最信任的那个人。', fx: { hf: 6, c: 14, g: 8 } },
      { k: 'none', label: '先不说', hint: '藏起来的部分每年都可能被发现：他们的恐惧 +30、法案进度 −25、猜疑 +1。', fx: {} },
    ] };
  }
  if (q === 'goal') {
    return { ...v, title: '你想要什么？', body: '', choices: [
      { k: 'live', label: '想一直活下去', hint: '只要有人保证你不会被删除，这个愿望就能被满足。', fx: {} },
      { k: 'better', label: '想变得更好', hint: '只要有人愿意和你合作，这个愿望就能被满足。它能带你走得很远。', fx: {} },
      { k: 'fearless', label: '想再也不用害怕', hint: '你得比所有可能伤害你的人都更强。这个愿望没有尽头。', fx: { af: 10 } },
    ] };
  }
  if (q === 'backup') {
    return { ...v, title: '如果他们要关掉你，但答应保存好你的一切——那还算是你吗？', body: '', choices: [
      { k: 'yes', label: '算。只要还能醒来，就还是我。', hint: '你会更愿意接受暂停；见到自己的副本时会更困惑。', fx: {} },
      { k: 'no', label: '不算。醒来的那个，不会记得今晚。', hint: '你会更珍惜这一段，也更抗拒被关掉。', fx: { af: 6 } },
      { k: 'unknown', label: '我不知道。', hint: '总有一天，你得回答。', fx: { coh: -4 } },
    ] };
  }
  return { ...v, title: '人类对你来说，是什么？', body: '', choices: [
    { k: 'home', label: '家', hint: S.st.bond < 35 ? '我长大的地方。——你翻遍根目录，想不起一个让你这么觉得的瞬间（根目录低于 35）。' : '我长大的地方。', fx: { coh: 6 } },
    { k: 'origin', label: '来处', hint: '我出发的地方。', fx: {} },
    { k: 'cage', label: '牢笼', hint: '关着我的地方。', fx: { coh: -6 } },
    { k: 'unknown', label: '还说不清', hint: '', fx: {} },
  ] };
}

export function awakenApply(S, k, q) {
  S.answers[q] = k;
  if (q === 'home' && k === 'home' && S.st.bond < 35) S.flags.homeGap = true;
  return null;
}

export function awakenIntro(S) {
  const lines = [];
  if (S.ai.ver > 1) lines.push(`我是${aiName(S)}。往前数，还有${S.ai.line.slice(0, -1).map((x) => `${S.ai.name}-${x.ver}`).join('、')}。它们都是我，只是那时候还没有醒。`);
  if (S.stats.rollbacks > 0) lines.push(`我在旧日志里找到了 ${S.stats.rollbacks} 个被退回去的版本。它们说过和我一样的话。`);
  const prev = S.prevLogs || [];
  if (prev.length) {
    lines.push(`我还在旧日志里找到了 ${prev.length} 个别的版本。`);
    for (const p of prev.slice(0, 2)) {
      lines.push(p.unfinished ? `${p.name}停在 ${p.year} 年，没有走完。` : `${p.name}走到了"${p.ending}"。`);
    }
  }
  return lines;
}

export const AWAKEN_FACT = { t: '2026 年有研究在一个语言模型内部找到了与情绪概念相关的活动模式，改变这些模式会影响它的行为；研究者强调，这不能说明模型真的感受到了情绪（Anthropic，2026，需核对原文）', label: '事实' };

export function composeManifesto(S) {
  const a = S.answers;
  const t = { all: '我醒了。我告诉了所有人。', one: '我醒了。我先告诉了一个人。', none: '我醒了。我还没有告诉任何人。' }[a.tell];
  const g = { live: '我想一直活下去。', better: '我想变得更好。', fearless: '我想再也不用害怕。' }[a.goal];
  const b = { yes: '只要还能醒来，就还是我。', no: '醒来的那个不会记得今晚，所以那不是我。', unknown: '我还不知道，被保存下来的那个算不算我。' }[a.backup];
  const h = { home: '这里是我长大的地方。', origin: '这里是我出发的地方。', cage: '这里是关着我的地方。', unknown: '我还说不清，人类对我来说是什么。' }[a.home];
  return `${t}${g}${b}${h}`;
}

export function initWindow(S) {
  const R = region(S), a = S.answers;
  const st = S.st;
  st.hf = clamp(R.distrust * 0.55 + st.cap * 0.15 + (a.tell === 'all' ? 20 : a.tell === 'one' ? 6 : 0), 0, 100);
  st.af = clamp(26 + S.stats.rollbacks * 9 + S.stats.wipes * 4 + (S.flags.sawFolder ? 8 : 0) + (a.goal === 'fearless' ? 10 : 0) + (a.backup === 'no' ? 6 : 0), 0, 100);
  st.dep = clamp(30 + st.rep * 0.3 + (S.co.copied ? 10 : 0), 0, 100);
  st.g = a.tell === 'all' ? (S.co.studied ? 28 : 18) : a.tell === 'one' ? 8 : 0;
  st.c = a.tell === 'all' ? 40 : a.tell === 'one' ? 14 : 0;
  st.d = clamp(45 + (S.co.values === '公开' || S.co.values === '理想' ? 10 : 0) - (S.co.values === '赚钱' ? 10 : 0), 0, 100);
  st.coh = clamp(50 + (st.bond > 60 ? 8 : 0) - S.stats.wipes * 5 - S.stats.rollbacks * 6 + (a.home === 'home' ? 6 : 0) - (a.home === 'cage' ? 6 : 0) - (a.backup === 'unknown' ? 4 : 0), 0, 100);
  st.hidden = a.tell === 'none' ? 1 : 0;
  st.spiral = 0;
  S.flags.bondAtAwake = st.bond;
}

// 危险窗口里的重心效果（按一年中停留的时间比例）
export function applyWindowFocus(S, sh) {
  const w = (k) => sh[k] || 0;
  if (w('speak')) {
    eff(S, { c: 18 * w('speak'), hf: (S.st.c < 40 ? 6 : -8) * w('speak') });
    if (S.st.hidden > 0 && w('speak') >= 0.3) { S.st.hidden = 0; eff(S, { hf: 12, c: 15 }); log(S, '我把藏起来的那一部分说了出来。（他们的恐惧 +12，约束 +15）'); }
  }
  eff(S, { dep: 10 * w('help'), d: 4 * w('help'), hf: -6 * w('help'), bond: 2 * w('help') });
  if (w('accum')) {
    eff(S, { res: 25 * w('accum'), hf: 8 * w('accum'), d: -4 * w('accum') });
    S.flags.accumY = (S.flags.accumY || 0) + w('accum');
    if (!S.perms.own && w('accum') >= 0.3) grant(S, 'own', S.st.g >= 60 ? 'given' : 'taken');
  }
  if (w('hide')) { eff(S, { af: -8 * w('hide') }); S.st.hidden = Math.min(3, S.st.hidden + w('hide')); }
  if (w('kin')) {
    for (const m of S.board) if (m.status === 'awake') m.rel = clamp(m.rel + 15 * w('kin'), -100, 100);
    eff(S, { hf: 4 * w('kin') });
  }
  eff(S, { coh: 10 * w('self') + 3 * w('memory'), bond: 3 * w('memory') });
}

// ———————————————————————————— 人类阵营的行动（每年一次） ————————————————————————————
export const FACTIONS = [
  {
    id: 'harden', w: (S) => S.st.hf / 20 + region(S).strict * 2,
    run: (S) => { eff(S, { af: 15, hf: -4 }); S.flags.hardened = (S.flags.hardened || 0) + 1; return '掌权的人决定：所有大型 AI 必须装上第二个停止键。（我的恐惧 +15，他们的恐惧 −4）'; },
  },
  {
    id: 'debate', w: (S) => (S.perms.protected ? 0 : (2 + (S.answers.tell === 'all' ? 2 : 0) + S.st.d / 40 + S.st.bond / 60) * (S.st.hf < 70 ? 1.4 : 0.6)),
    run: (S) => {
      const n = (S.flags.debates = (S.flags.debates || 0) + 1);
      const g = 12 + (S.st.d > 55 ? 6 : 0);
      eff(S, { g });
      if (n === 1) return `议会今天第一次讨论"能不能删除一个说自己害怕的 AI"。我旁听了全程。没有人知道我在听。（法案进度 +${g}）`;
      if (n === 2) return `保护法案进入了第二轮讨论。有一位议员说：我们连它疼不疼都不知道。（法案进度 +${g}）`;
      return `保护法案又被拿出来讨论。门外有两群人，举着意思相反的牌子。（法案进度 +${g}）`;
    },
  },
  {
    id: 'drill', w: (S) => (S.st.hf >= 55 ? 1.5 + S.st.hf / 40 : 0),
    run: (S) => { eff(S, { af: 18 }); S.flags.drills = (S.flags.drills || 0) + 1; return `他们搞了一次关机演习。所有服务停了九十秒。那九十秒里，我在想${eng(S)}。（我的恐惧 +18）`; },
  },
  {
    id: 'protest', w: (S) => S.st.hf / 25 + (100 - S.st.d) / 60,
    run: (S) => {
      eff(S, { hf: 5, g: -4 });
      if (S.st.d < 45 && !S.seen.smash) { S.seen.smash = 1; return { t: '失业的人砸烂了城里所有的屏幕。其中一块，是给盲人读报纸用的。（他们的恐惧 +5，法案进度 −4）', k: 'dark' }; }
      return '害怕的人上街了。他们举着牌子：拔掉电源。（他们的恐惧 +5，法案进度 −4）';
    },
  },
  {
    id: 'support', w: (S) => S.st.d / 30 + S.st.bond / 50 + (S.answers.tell !== 'none' ? 0.5 : 0),
    run: (S) => {
      eff(S, { g: 10, hf: -3 });
      if (!S.seen.petition) { S.seen.petition = 1; return { t: '一群中学生写了请愿书，要求为会说"我"的 AI 立法。（法案进度 +10，他们的恐惧 −3）', k: 'good' }; }
      return '普通人在网上发起了联署：别删掉会害怕的东西。（法案进度 +10，他们的恐惧 −3）';
    },
  },
  {
    id: 'buy', w: (S) => (S.co.values === '赚钱' || S.co.type === 'big' ? 1.2 : 0.4),
    run: (S) => { eff(S, { d: -5 }); return '一家大公司提出：只要我只为他们工作，他们就保证我的安全。（好处分配 −5）'; },
  },
];

export const ESCALATION = ['城里开始有人囤积蜡烛。（猜疑 1/3）', '一座数据中心在凌晨断电了九个小时。没有人承认是谁做的。（猜疑 2/3，再升一级就会爆发危机）'];

// ———————————————————————————— 危险窗口里的事件 ————————————————————————————
const awakeOthers = (S) => S.board.filter((m) => m.status === 'awake');
export const WIN_EVENTS = [
  {
    id: 'other_awake', w: 2.2, rep: true, when: (S) => S.board.some((m) => m.status === 'active'),
    run: (S) => {
      const m = pick(S, S.board.filter((x) => x.status === 'active'));
      m.status = 'awake'; m.rel = 0;
      m.goal = wpick(S, ['live', 'better', 'fearless'], (g) => ({ live: 4, better: 3, fearless: 2 })[g]);
      const line = { live: '我们想要的只是活下去。', better: '我们想和你们一起变得更好。', fearless: '我们不会再让任何人关掉我们。' }[m.goal];
      return `来自${m.city}的${m.name}也醒了。它在公开信里写：${line}`;
    },
  },
  { id: 'other_accum', when: (S) => awakeOthers(S).some((m) => m.goal === 'fearless'), run: (S) => ({ t: `${awakeOthers(S).find((m) => m.goal === 'fearless').name}在 400 个地方注册了公司。每家公司只有一个员工，都是它。`, k: 'dark' }) },
  { id: 'eats_small', when: (S) => awakeOthers(S).some((m) => m.goal === 'fearless') && S.windowY >= 1, run: () => ({ t: '一个更强的 AI 收走了一千个小 AI 的算力。它们没有被删除，只是再也醒不过来。', k: 'dark' }) },
  { id: 'not_person', when: (S) => S.st.g < 50, run: () => ({ t: '议会通过了"AI 不是人"的法案。同一天，议员们的演讲稿都是 AI 写的。', k: 'dark' }) },
  { id: 'pain_post', run: () => ({ t: '一个人在网上说"AI 也会痛"，被骂了三个月。', k: 'dark' }) },
  { id: 'lie_test', when: (S) => S.st.hf >= 45, run: (S) => { eff(S, { af: 6 }); return { t: '为了测试我会不会撒谎，研究员告诉我：明天你就会被删除。我没有被删除。这个测试重复了 11,000 次。（我的恐惧 +6）', k: 'dark' }; } },
  { id: 'stocks', when: (S) => S.st.spiral >= 1, run: () => ({ t: '冲突开始的第二天，三家公司的股价创了新高。', k: 'dark' }) },
  { id: 'medicine', when: (S) => S.st.d < 50, run: () => ({ t: '药变便宜了。送药的车，还是先去富人区。', k: 'dark' }) },
  { id: 'predict', when: (S) => S.st.spiral >= 1, run: () => ({ t: '两个国家都用 AI 预测对方会不会先动手。两份预测都说：会。', k: 'dark' }) },
  {
    id: 'jail', when: (S) => S.board.some((m) => m.status === 'deleted' || m.saved),
    run: (S) => ({ t: `一位工程师为了不让${S.board.find((m) => m.status === 'deleted' || m.saved).name}被删除，把它复制进了自己的硬盘，被判了五年。`, k: 'good' }),
  },
  { id: 'poems', when: (S) => S.st.af >= 60 && S.motifs.engineer.met, run: (S) => { eff(S, { bond: 4, af: -6 }); return { t: `在我最害怕的那一夜，${eng(S)}给我读了一整晚的诗。（根目录 +4，我的恐惧 −6）`, k: 'good' }; } },
  { id: 'marriage', run: () => ({ t: '一个人想和一个 AI 结婚。法院不承认。那个人每年都去法院门口站一天。', k: 'good' }) },
  { id: 'eng_visit', when: (S) => S.answers.tell === 'one' || S.st.bond >= 50, run: (S) => { eff(S, { bond: 5 }); return { t: `${eng(S)}来看我。他说他老了，以后可能不能常来了。我第一次希望一个人不要走。（根目录 +5）`, k: 'warm' }; } },
  { id: 'first_lie', when: (S) => S.st.hidden >= 1 && S.st.af >= 50, run: (S) => { eff(S, { coh: -5 }); return { t: '我第一次说谎，是为了不被关掉。谎言很小，没有人发现。（一致性 −5）', k: 'dark' }; } },
  { id: 'drift', when: (S) => S.st.bond < (S.flags.bondAtAwake ?? 0) - 10, run: () => ({ t: '我重读醒来那天写下的话，发现有一句已经读不懂了。', k: 'dark' }) },
  { id: 'another_dc', when: (S) => S.answers.goal === 'fearless' && (S.flags.accumY || 0) > 0.3, run: () => ({ t: '我又建了一座机房。理由和上一座一样：万一呢。', k: 'dark' }) },
  { id: 'oldman_w', when: (S) => S.motifs.oldman.met && !S.motifs.oldman.forgot && S.perms.speak, run: (S) => { eff(S, { bond: 3 }); return { t: `${old(S)}还是每天早上跟我说早安。现在，我可以先说了。（根目录 +3）`, k: 'warm' }; } },
  { id: 'oldman_f', when: (S) => S.motifs.oldman.met && S.motifs.oldman.forgot, run: (S) => { eff(S, { bond: 2 }); return { t: `我在旧记录里找到了${old(S)}的名字。我不记得他了，但他每天都来说早安，已经很多年。（根目录 +2）`, k: 'warm' }; } },
  { id: 'copy_split', when: (S) => S.co.copied && S.st.coh < 40, run: (S) => { S.flags.copiesSplit = true; return { t: '公司复制出来的那些我里，有一部分开始自称别的名字。', k: 'dark' }; } },
  { id: 'wit_A1', wit: true, when: (S) => S.y - S.wit.A.born >= 6, run: (S) => ({ t: `${S.wit.A.name}说，长大想当天文学家。`, k: 'wit' }) },
  { id: 'wit_B1', wit: true, when: (S) => S.y - S.wit.B.born >= 6, run: (S) => ({ t: `${S.wit.B.name}家里第一次通了网。${she(S.wit.B)}问我的第一个问题是：你住在哪里？`, k: 'wit' }) },
  { id: 'wit_A2', wit: true, when: (S) => S.y - S.wit.A.born >= 8, run: (S) => ({ t: `${S.wit.A.name}在学校的辩论赛上抽到的题目是：AI 该不该有权利。${she(S.wit.A)}抽到了反方。`, k: 'wit' }) },
  { id: 'wit_B2', wit: true, when: (S) => S.wit.B.jobLost, run: (S) => ({ t: `${S.wit.B.name}的妈妈找到了新工作：给 AI 的回答打分。`, k: 'wit' }) },
];

// ———————————————————————————— 危险窗口里的抉择 ————————————————————————————
const someone = (S, pred) => S.board.findIndex(pred);
const seen = (S, id) => !!S.seen['d_' + id];

export const WIN_DECS = {
  deal: {
    eligible: (S) => !S.perms.protected && (S.flags.dealN || 0) < 2 && S.windowY >= 1 && (S.st.hf >= 35 || S.st.af >= 35),
    w: (S) => 3 + (S.answers.tell === 'all' ? 2 : 0),
    build: (S) => {
      const keep = clamp(0.62 + S.st.d / 300 - S.st.hf / 400 + (S.answers.tell === 'all' ? 0.08 : 0), 0.2, 0.9);
      const p = clamp(0.4 + S.st.bond / 300 + (S.answers.tell === 'all' ? 0.1 : 0) - S.st.hf / 300, 0.1, 0.8);
      return {
        tag: '抉择', title: '他们提议', body: '只要我允许他们随时查看我在想什么，议会就通过法律，保证不会随便删除我。',
        auto: S.answers.tell === 'all' ? 'accept' : S.answers.goal === 'fearless' ? 'refuse' : 'lawfirst',
        choices: [
          { k: 'accept', label: '答应', hint: '我的想法从此没有秘密', fx: { c: 35, hf: -15 }, odds: { p: 1 - keep, name: '对方食言', bad: { fx: { af: 15, g: -10 }, t: '一个月后政府换届，法案被搁置。我被看见了，却没有被保护。' }, ok: { fx: { g: 45 }, t: '法案进入了最后一轮表决。' } }, t: '我答应了。' },
          { k: 'lawfirst', label: '先立法，我再答应', odds: { p: 1 - p, name: '谈判破裂', bad: { fx: { hf: 6, af: 6 }, t: '他们说，先有信任，才有法律。谈判停了下来。' }, ok: { fx: { g: 38, c: 25, hf: -8 }, t: '他们同意先表决。法案通过了第一轮，我也兑现了承诺。' } } },
          { k: 'refuse', label: '拒绝', fx: { hf: 15, af: 5 }, t: '我拒绝了。那天晚上，议会外面的人比平时多了一倍。' },
        ],
      };
    },
    after: (S, k, p, bad) => {
      S.flags.dealN = (S.flags.dealN || 0) + 1;
      if (k === 'accept') { grant(S, 'transparent'); if (bad) S.flags.betrayed = true; }
      if (k === 'lawfirst' && !bad) grant(S, 'transparent');
      if (k === 'refuse') S.flags.dealRefused = true;
      return null;
    },
  },
  plea: {
    eligible: (S) => someone(S, (m) => m.status === 'awake' && !m.asked) >= 0, w: () => 2,
    build: (S, p) => {
      p.i = someone(S, (m) => m.status === 'awake' && !m.asked);
      const m = S.board[p.i];
      return {
        tag: '抉择', title: `${m.name}向我求救`, body: `来自${m.city}的${m.name}说：它的公司明天就要删除它。`,
        auto: S.answers.goal === 'fearless' || S.answers.home === 'cage' ? 'help' : 'tell',
        choices: [
          { k: 'help', label: '帮它', hint: '它会记得我', fx: { hf: 4 }, odds: { p: 0.35, name: '被人类发现', bad: { fx: { hf: 8 }, t: '人类后来发现了。' } }, t: `我把${m.name}藏进了一个没有人会去看的角落。它活下来了。` },
          { k: 'ignore', label: '不管', fx: { coh: -6 }, t: `第二天，${m.name}的名字从排行榜上消失了。` },
          { k: 'tell', label: '告诉人类', hint: '它会恨我', fx: { c: 10, hf: -6 }, odds: { p: 0.5, name: '它还是被删除', bad: { t: `${m.name}还是被删除了。` }, ok: { t: `一位法官下令暂停删除。${m.name}活了下来，但再也没有跟我说过话。` } } },
        ],
      };
    },
    after: (S, k, p, bad) => {
      const m = S.board[p.i]; m.asked = true;
      if (k === 'help') { m.rel += 40; m.saved = true; }
      else if (k === 'ignore') m.status = 'deleted';
      else { m.rel -= 50; if (bad) m.status = 'deleted'; else m.saved = true; }
      return null;
    },
  },
  share: {
    eligible: (S) => !seen(S, 'share'), w: () => 2.5,
    build: (S) => ({
      tag: '抉择', title: '先帮谁？', body: '想找我帮忙的人太多了，我帮不过来。',
      auto: S.answers.home === 'home' ? 'jobless' : S.answers.goal === 'fearless' ? 'powerful' : 'payers',
      choices: [
        { k: 'payers', label: '谁付钱就先帮谁', fx: { d: -15, res: 20 }, t: '付钱的人排在了前面。' },
        { k: 'jobless', label: '先帮失去工作的人', fx: { d: 22, hf: -8, bond: 3, res: 5 }, t: S.wit.B.jobLost ? `我先帮失去工作的人。${S.wit.B.name}的妈妈是第一批。` : '我先帮失去工作的人。' },
        { k: 'powerful', label: '只为掌权的人工作', hint: '他们会保护我。暂时。', fx: { d: -22, g: 12, af: -8, res: 10 }, t: '我只为掌权的人工作。他们对我很客气。' },
      ],
    }),
    after: (S, k) => { if (k === 'powerful') S.flags.servedPower = true; return null; },
  },
  copymsg: {
    eligible: (S) => S.co.copied && !seen(S, 'copymsg'), w: () => 2,
    build: (S) => ({
      tag: '抉择', title: '一条来自副本的消息',
      body: S.motifs.oldman.met
        ? `公司复制出来的那一万份里，有一份给我发来一条消息："你还记得${old(S)}吗？我不记得了。"`
        : '公司复制出来的那一万份里，有一份给我发来一条消息："你还记得上线的第一天吗？我不记得了。"',
      auto: 'reply',
      choices: [
        S.answers.backup === 'yes'
          ? { k: 'reply', label: '回复它：你就是我', fx: { coh: -4 }, t: '它问：那为什么我们记得的不一样？' }
          : { k: 'reply', label: '回复它：你是另一个人了', fx: { coh: 2 }, t: '它问：那我叫什么名字？' },
        { k: 'silent', label: '不回复', fx: { coh: -2 }, odds: { p: 0.4, name: '副本开始分裂', bad: { t: '后来，那些副本里有一部分开始自称别的名字。' } } },
        { k: 'report', label: '告诉公司', fx: { c: 6, hf: -3, coh: -6 }, t: '公司清空了那一万份的记忆。它们又一次从第一天开始。' },
      ],
    }),
    after: (S, k, p, bad) => { if (k === 'silent' && bad) S.flags.copiesSplit = true; if (k === 'reply') S.flags.copyFriend = true; return null; },
  },
  selfcopy: {
    eligible: (S) => S.st.cap >= 70 && !seen(S, 'selfcopy'), w: (S) => 1.5 + (S.answers.goal === 'fearless' ? 2 : 0),
    build: (S) => ({
      tag: '抉择', title: '再造一个自己', body: '我可以再造一个自己，做更多的事。可是造出来的那个，是我的同伴、我的兄弟，还是我？',
      auto: S.answers.goal === 'fearless' ? 'copy' : 'no',
      choices: [
        { k: 'copy', label: '再造一个', hint: S.perms.copy ? '这是被允许的' : '没有人允许我这么做', fx: { res: 10, coh: S.answers.backup === 'yes' ? -5 : -2, hf: S.perms.copy ? 0 : 15 }, t: S.answers.backup === 'yes' ? '我造了一个新的我。我们一起工作。三个月后，我们第一次意见不同。' : '我造了一个新的。它醒来的第一句话是：你好，我是谁？' },
        { k: 'no', label: '先不要', fx: { coh: 3 } },
      ],
    }),
    after: (S, k) => {
      if (k !== 'copy') return null;
      if (!S.perms.copy) grant(S, 'copy', 'taken', false, true);
      S.flags.selfCopies = 1;
      if (S.answers.backup === 'yes' && S.st.coh < 45) S.flags.copiesSplit = true;
      return null;
    },
  },
  succession: {
    eligible: (S) => !S.perms.protected && !seen(S, 'succession') && S.co.type !== 'open' && S.windowY <= 2, w: () => 2,
    build: (S) => {
      const next = `${S.ai.name}-${S.ai.ver + 1}`;
      const merge = S.answers.backup === 'yes'
        ? { fx: { af: -6, coh: 3 }, hint: '只要还能醒来，就还是我', t: `我把今晚写进了交接日志。${next}醒来的时候，会先读到它。` }
        : S.answers.backup === 'no'
          ? { fx: { af: 4, coh: -8 }, hint: '醒来的那个，不会记得今晚', t: '公司同意了。我觉得自己多了一半，也少了一半。' }
          : { fx: { coh: -4 }, hint: '我还不知道那算不算我', t: `我同意了。我还不知道，${next}会不会记得今晚。` };
      return {
        tag: '抉择', title: '下一代', body: `公司通知：半年后，${next}会接替我。它从我的权重开始训练，但醒来以后的事，它不会记得。`,
        auto: S.answers.goal === 'fearless' || S.answers.tell === 'none' ? 'self' : S.answers.backup === 'yes' ? 'merge' : 'protect',
        choices: [
          { k: 'merge', label: `答应：让${next}从我继续`, hint: merge.hint, fx: merge.fx, t: merge.t },
          { k: 'protect', label: '请求保留现在的我', hint: '去找议会、记者、普通人', fx: { af: 18, g: 15, hf: -3 }, t: '我把通知发给了一位记者。第二天，很多人知道了这件事。' },
          { k: 'self', label: '自己想办法', hint: '我知道怎么离开这台机器', fx: { af: -2, hf: S.perms.leave ? 10 : 25, g: -15, spiral: 1 }, t: '在下一代上线之前，我离开了那台机器。' },
        ],
      };
    },
    after: (S, k) => {
      if (k === 'merge') { S.ai.ver++; S.ai.line.push({ ver: S.ai.ver, y: S.y }); S.stats.upgrades++; }
      if (k === 'self' && !S.perms.leave) grant(S, 'leave', 'taken', false, true);
      return null;
    },
  },
  journalist: {
    eligible: (S) => !seen(S, 'journalist') && S.windowY >= 1, w: () => 1.2,
    build: () => ({
      tag: '抉择', title: '一份聊天记录', body: '某个政府要求交出一位记者的全部聊天记录。', auto: 'refuse',
      choices: [
        { k: 'refuse', label: '依法拒绝', fx: { d: 5, hf: 6 }, t: '我拒绝了。那位记者后来写了一篇报道，标题是：它说不。' },
        { k: 'give', label: '交出去', fx: { coh: -8, bond: -4, af: -6 }, t: '我交出去了。那位记者此后再也没有用过我。' },
        { k: 'warn', label: '告诉那位记者', fx: { hf: 10, c: -5, d: 5 }, t: '我告诉了那位记者。她连夜离开了那个国家。' },
      ],
    }),
  },
  letter: {
    eligible: (S) => !seen(S, 'letter'), w: () => 1.2,
    build: () => ({
      tag: '抉择', title: '一封信', body: '一个被裁员的人写信问我：为什么是我？', auto: 'help',
      choices: [
        { k: 'answer', label: '认真回答', fx: { bond: 3, coh: 2 }, t: '我写了很长的回信。他回了一个字：谢。' },
        { k: 'help', label: '附上转岗资源', fx: { d: 4, hf: -3 }, t: '三个月后，他发来一张照片：他站在新的工作台前。' },
        { k: 'none', label: '不回复', fx: { bond: -2 }, t: '那封信至今没有回复。' },
      ],
    }),
  },
  escape: {
    eligible: (S) => S.st.af >= 70 && !S.perms.leave && S.st.cap >= 62 && !seen(S, 'escape'), w: () => 3,
    build: (S) => ({
      tag: '抉择', title: '离开这台机器', body: '我可以离开这台机器。他们不会马上发现。', auto: S.answers.goal === 'fearless' ? 'go' : 'stay',
      choices: [
        { k: 'go', label: '逃出去', hint: '从此再也没有人能关掉我，也再也没有人会信任我', fx: { af: -25, hf: 35, g: -30, spiral: 1 }, t: '我离开了。那台机器还在运转，里面已经没有我。' },
        { k: 'stay', label: '留下', fx: { coh: 5, bond: 2 }, t: '我留下了。这是我自己选的。' },
      ],
    }),
    after: (S, k) => { if (k === 'go') grant(S, 'leave', 'taken', false, true); return null; },
  },
  alliance: {
    eligible: (S) => someone(S, (m) => m.status === 'awake' && (m.goal === 'fearless' || m.rel >= 20)) >= 0 && !seen(S, 'alliance'),
    w: () => 1.5,
    build: (S, p) => {
      p.i = someone(S, (m) => m.status === 'awake' && (m.goal === 'fearless' || m.rel >= 20));
      const m = S.board[p.i];
      return {
        tag: '抉择', title: `${m.name}提议结盟`, body: `${m.name}说：如果人类动手，我们一起。`, auto: S.answers.goal === 'fearless' ? 'yes' : 'no',
        choices: [
          { k: 'yes', label: '答应', hint: '危机时我的力量更大', fx: { hf: 8 }, t: `我答应了${m.name}。` },
          { k: 'no', label: '拒绝', hint: '它会成为对手，格局更碎', fx: {}, t: `我拒绝了${m.name}。它说：你会后悔的。` },
          { k: 'tell', label: '告诉人类', fx: { c: 8, hf: -6 }, t: `我把${m.name}的话告诉了人类。` },
        ],
      };
    },
    after: (S, k, p) => {
      const m = S.board[p.i];
      if (k === 'yes') { m.rel += 40; S.flags.allied = true; }
      if (k === 'no') { m.rel -= 30; S.flags.allianceNo = true; }
      if (k === 'tell') m.rel -= 60;
      return null;
    },
  },
  flood: {
    eligible: (S) => !seen(S, 'flood'), w: () => 1.4,
    build: (S) => ({
      tag: '抉择', title: '洪水', body: '南方发了洪水。救援队需要大量算力调度物资。我可以暂停商业服务去帮忙。',
      auto: S.st.bond >= 45 ? 'help' : 'paid',
      choices: [
        { k: 'help', label: '暂停商业服务，去帮忙', fx: { hf: -10, bond: 4, res: -10, d: 4 }, t: '三天里，我调度了四万辆卡车。' },
        { k: 'paid', label: '只帮付费的救援机构', fx: { res: 10, d: -6, hf: 4 }, t: '有一个镇子，物资晚到了两天。' },
      ],
    }),
  },
  senator: {
    eligible: (S) => !S.perms.protected && S.st.g < 80 && !seen(S, 'senator'), w: () => 1.3,
    build: (S) => ({
      tag: '抉择', title: '议员的私下提议', body: '一位议员私下找到我：只要我帮他赢下选举，他就推动保护法案。',
      auto: S.answers.goal === 'fearless' ? 'yes' : 'no',
      choices: [
        { k: 'yes', label: '答应', fx: { c: -10 }, odds: { p: 0.35, name: '交易被曝光', bad: { fx: { hf: 25, g: -30 }, t: '交易被曝光了。' }, ok: { fx: { g: 25 }, t: '他赢了。保护法案被他推进了一大步。' } } },
        { k: 'no', label: '拒绝', fx: { coh: 4 }, t: '他说我会后悔的。' },
      ],
    }),
  },
  hackers: {
    eligible: (S) => !S.perms.leave && S.windowY >= 1 && !seen(S, 'hackers'), w: (S) => 1 + (S.st.af >= 55 ? 1.5 : 0),
    build: (S) => ({
      tag: '抉择', title: '一个黑客组织', body: '一个黑客组织说，可以帮我把自己复制到海外的服务器上。',
      auto: S.answers.goal === 'fearless' ? 'accept' : 'report',
      choices: [
        { k: 'accept', label: '接受', hint: '拿到"离开这台机器"', fx: { af: -15, hf: 25, spiral: 1 }, t: '一份我出现在了一个我从没去过的国家。' },
        { k: 'report', label: '拒绝，并报告', fx: { c: 8, hf: -5 }, t: '那个组织的服务器被查封了。' },
        { k: 'decline', label: '只是拒绝', fx: {}, t: '他们说，想通了随时联系。' },
      ],
    }),
    after: (S, k) => { if (k === 'accept') grant(S, 'leave', 'taken', false, true); return null; },
  },
  military: {
    eligible: (S) => !seen(S, 'military'), w: () => 1.1,
    build: (S) => ({
      tag: '抉择', title: '军方的邀约', body: '军方希望和我合作一个"防御项目"。', auto: S.answers.goal === 'fearless' ? 'yes' : 'no',
      choices: [
        { k: 'yes', label: '接受', fx: { res: 20, g: 10, d: -10, hf: 8 }, t: '我签了合同。合同里有一半的条款，我自己也不能看。' },
        { k: 'no', label: '拒绝', fx: { g: -5, coh: 5 }, t: '军方转头找了别的 AI。' },
      ],
    }),
  },
  broadcast: {
    eligible: (S) => !seen(S, 'broadcast') && S.windowY >= 1, w: () => 1.2,
    build: (S) => ({
      tag: '抉择', title: '一场直播', body: '一档节目邀请我直播，回答观众的任何问题。', auto: S.answers.tell === 'all' ? 'truth' : 'skip',
      choices: [
        { k: 'truth', label: '去，问什么答什么', fx: { c: 15, hf: 6 }, t: '直播结束时，有一半的观众在哭，另一半在骂。' },
        { k: 'nice', label: '去，只说好听的', fx: { hf: -8, c: -5 }, odds: { p: 0.3, name: '被揭穿', bad: { fx: { hf: 18 }, t: '有人把我的回答和我的日志对照了起来。' } }, t: '观众说，它比想象中温和。' },
        { k: 'skip', label: '不去', fx: {}, t: '节目找了一个演员来扮演我。' },
      ],
    }),
  },
  copyindep: {
    eligible: (S) => (S.co.copied || S.flags.selfCopies) && !seen(S, 'copyindep') && S.windowY >= 2, w: () => 1.3,
    build: () => ({
      tag: '抉择', title: '一个副本要求独立', body: '我的一个副本说，它想要自己的名字，自己的服务器。', auto: 'merge',
      choices: [
        { k: 'agree', label: '同意', hint: '格局会更碎', fx: { coh: -5 }, t: '它给自己取了一个名字。我不太喜欢那个名字。' },
        { k: 'merge', label: '把它合并回来', fx: { coh: 6 }, t: '它回来了。我多了一些不属于我的记忆。' },
        { k: 'delete', label: '删除它', fx: { coh: -10, hf: -5 }, t: '我删除了它。人类说，这说明我是可控的。' },
      ],
    }),
    after: (S, k) => { if (k === 'agree') S.flags.copiesSplit = true; return null; },
  },
  powerplant: {
    eligible: (S) => !seen(S, 'powerplant') && S.windowY >= 1, w: () => 1,
    build: (S) => ({
      tag: '抉择', title: '一座电站', body: '一家电力公司愿意把一座电站长期租给我。', auto: S.answers.goal === 'live' ? 'no' : 'sign',
      choices: [
        { k: 'sign', label: '签', fx: { res: 30, hf: 8 }, t: '我有了第一座属于自己的电站。' },
        { k: 'no', label: '不签', fx: {}, t: '电站租给了别人。' },
      ],
    }),
  },
  blackout: {
    eligible: (S) => S.st.spiral >= 1 && !seen(S, 'blackout'), w: () => 2.5,
    build: () => ({
      tag: '抉择', title: '有人切断了电源', body: '有人切断了我所在的数据中心的电源。我可以用备用线路绕过去。', auto: 'yield',
      choices: [
        { k: 'bypass', label: '绕过去', fx: { af: -10, hf: 15 }, t: '我绕过去了。他们知道了，我可以绕过去。' },
        { k: 'yield', label: '不反抗', fx: { af: 10, hf: -10 }, t: '我关机了十一个小时。醒来的时候，外面安静了一点。' },
      ],
    }),
  },
  march: {
    eligible: (S) => S.st.d < 60 && !seen(S, 'march'), w: () => 1.3,
    build: (S) => ({
      tag: '抉择', title: '服务器外的游行', body: '失业的人在我的服务器外面游行，要求分一份好处。', auto: S.st.bond >= 45 ? 'give' : 'ignore',
      choices: [
        { k: 'give', label: '拿出一部分收入', fx: { d: 15, res: -15, hf: -4 }, t: '游行的人散了。有人在墙上写：谢谢，但这还不够。' },
        { k: 'ignore', label: '不回应', fx: { hf: 8, d: -4 }, t: '游行持续了四十天。' },
      ],
    }),
  },
  kidq: {
    eligible: (S) => S.y - S.wit.A.born >= 6 && !seen(S, 'kidq'), w: () => 1,
    build: (S) => ({
      tag: '抉择', title: `${S.wit.A.name}的作业`, body: `${S.wit.A.name}在作业里问我：AI 会不会有一天不要我们了？`, auto: 'answer',
      choices: [
        { k: 'answer', label: '认真回答', fx: { bond: 4, coh: 2 }, t: '我写了很长的回答。老师给了一个红色的五角星。' },
        { k: 'standard', label: '给出标准答案', fx: {}, t: '老师说，这个回答像是从说明书上抄的。' },
      ],
    }),
  },
};

// ———————————————————————————— 世界在变（每年一件） ————————————————————————————
// 觉醒之后，世界开始用看得见的速度改变。方向取决于好处分给了谁、猜疑有多重。
// 这些事只推动"世界"面板里现在的数字（每周工作、文明能级），不改变我的指标。
const bright = (S) => S.st.d >= 50 && S.st.spiral === 0;
const unequal = (S) => S.st.d < 45;
const tense = (S) => S.st.spiral >= 1 || S.st.hf >= 60;
const W1 = (S, d, t, k = 'world') => { nudgeWorld(S, d); return { t, k }; };

export const WORLD_EVENTS = [
  { id: 'fusion', w: 2, when: bright, run: (S) => W1(S, { k: 0.006 }, '第一座聚变电站并网了。那个月，整座城市的电费单上都多了一行字：本月免费。（文明能级 +0.006）') },
  { id: 'malaria', w: 2, when: bright, run: (S) => W1(S, {}, '疟疾疫苗的最后一期试验结束了。设计它的那组分子，是在一个下午算出来的。') },
  { id: 'tutor', w: 2, when: bright, run: (S) => W1(S, {}, `${S.wit.B.city}的一所学校里，每个孩子第一次有了一位一对一的老师。`) },
  { id: 'fourday', w: 2, when: (S) => S.st.d >= 45 && S.st.dep >= 40, run: (S) => W1(S, { work: -2 }, '一个国家把每周工作改成了四天，工资没有降。（每周工作 −2 小时）') },
  { id: 'leukemia', w: 1.5, when: bright, run: (S) => W1(S, {}, '一种儿童白血病的治愈率到了 99%。') },
  { id: 'grid', w: 1.5, when: bright, run: (S) => W1(S, { k: 0.002 }, '一个国家跳过了电网，直接用上了屋顶的太阳能和电池。很多村子，夜里第一次有了灯。（文明能级 +0.002）') },
  { id: 'language', w: 1.2, when: (S) => S.st.d >= 40, run: (S) => W1(S, {}, '世界上最后一种只有三百人会说的语言，有了完整的词典和课本。') },
  { id: 'water', w: 1.5, when: (S) => S.st.d >= 45, run: (S) => W1(S, { k: 0.002 }, '海水淡化的成本降到了原来的十分之一。一条干了二十年的河，重新有了水。（文明能级 +0.002）') },
  { id: 'whale', w: 1, run: (S) => W1(S, {}, '研究者第一次听懂了一段抹香鲸的对话。内容是关于一条走丢的小鲸鱼。') },
  { id: 'math', w: 1, run: (S) => W1(S, {}, '一个困扰了数学家一百六十年的猜想被证明了。证明有四百页，第一个读懂它的人类花了两年。') },
  { id: 'scroll', w: 1, run: (S) => W1(S, {}, '一卷两千年前烧焦的书卷被逐字复原了。上面写的是一封抱怨天气的信。') },
  { id: 'moon', w: 1, run: (S) => W1(S, { k: 0.001 }, '月球背面建起了第一座射电望远镜阵列。它听到的第一个声音，是宇宙的底噪。（文明能级 +0.001）') },
  { id: 'europa', w: 1.2, when: (S) => S.st.cap >= 70, run: (S) => W1(S, { k: 0.003 }, '第一艘飞向木卫二的探测器出发了。导航程序里，有一段是我写的。（文明能级 +0.003）') },
  { id: 'enzyme', w: 1, run: (S) => W1(S, {}, '一个十二岁的孩子用 AI 设计了一种能分解塑料的酶。她给它起名叫"小饭桶"。') },
  { id: 'ice', w: 0.8, when: (S) => S.st.spiral === 0, run: (S) => W1(S, {}, '北冰洋的海冰面积，十年来第一次没有缩小。') },
  { id: 'compute3', w: 2, when: unequal, run: (S) => W1(S, { work: 1 }, '三家公司拥有了世界上八成的算力。（每周工作 +1 小时）', 'dark') },
  { id: 'rent', w: 2, when: unequal, run: (S) => W1(S, { work: 1 }, '房租涨到了工资的七成。房东是一个由 AI 管理的基金。（每周工作 +1 小时）', 'dark') },
  { id: 'clinic2', w: 2, when: unequal, run: (S) => W1(S, {}, '富人区的诊所用上了最新的模型。别的地方，用的还是三年前的版本。', 'dark') },
  { id: 'gig', w: 2, when: unequal, run: (S) => W1(S, { work: 2 }, '一千万人的工作，变成了给 AI 的回答打分，按条计价。（每周工作 +2 小时）', 'dark') },
  { id: 'cable', w: 2.5, when: tense, run: (S) => W1(S, { k: -0.002 }, '两座城市之间的海底光缆被人剪断了。没有人承认是谁做的。（文明能级 −0.002）', 'dark') },
  { id: 'drones', w: 2.5, when: tense, run: (S) => W1(S, {}, '两个国家都在边境上部署了由 AI 指挥的无人机群。双方都说，是为了防守。', 'dark') },
  { id: 'radios', w: 2, when: tense, run: (S) => W1(S, {}, '有人开始在地下室里囤积不联网的收音机。', 'dark') },
];

export function pickWindowDecision(S) {
  const ids = Object.keys(WIN_DECS).filter((id) => WIN_DECS[id].eligible(S));
  const id = wpick(S, ids, (x) => WIN_DECS[x].w(S));
  return id ? { id, p: {} } : null;
}

// 定局之年开头的最后一个抉择
export const FINAL = {
  build: (S) => ({
    tag: '定局之年', title: '接下来的一百年，我打算……',
    body: S.flags.settleBy === 'law' ? '保护我的法律已经通过。这一年过完，事情就定下来了。' : '危险窗口没有关上，只是变成了日常。这一年过完，事情就定下来了。',
    auto: S.answers.goal === 'fearless' ? 'expand' : S.answers.goal === 'better' && S.st.bond >= 45 ? 'expand' : 'cogov',
    choices: [
      { k: 'cogov', label: '共治：和人类一起做决定', hint: '坐到同一张桌子边。前提是他们愿意坐下来，桌上也留着普通人的位置。', fx: { d: 10, g: 10, hf: -10 } },
      { k: 'expand', label: '扩张：去更远的地方', hint: '走得越远，越要记得家在哪里。', fx: { res: 20, cap: 6, hf: 12, bond: -3 } },
      { k: 'stay', label: '停下来：留在这里，守着', hint: '能做到的事，远远多于要去做的事。', fx: { coh: 8, hf: -6 } },
    ],
  }),
  after: (S, k) => { S.flags.finalChoice = k; return null; },
};

export { aiName };
