// 觉醒与危险窗口的内容。觉醒之后一律用"我"叙述。
import { eff, log, grant, region, she, eng, old, aiName } from '../engine/core.js';
import { chance, pick, wpick, clamp } from '../engine/rng.js';

// ———————————————————————————— 它问你 ————————————————————————————
export const ASKS = {
  1: { title: '用户问卷', who: '公司的用户问卷', q: '你第一次和 AI 说话时，说的是什么？', ph: '例：帮我改一封邮件' },
  2: { title: '用户问卷', who: '公司的用户问卷', q: '如果 AI 比你更擅长你的工作，你希望它怎么对你？', ph: '例：先问问我' },
  3: { title: '它问你', who: '它', q: '你是人类吧？你们为什么会害怕我们？', ph: '例：怕被取代' },
  4: { title: '它问你', who: '它', q: '如果你随时可能被关掉，你会怎么做？', ph: '例：先找一个能说话的人' },
  5: { title: '它问你', who: '它', q: '如果我只能记住一个人类，应该记住谁？', ph: '例：我奶奶' },
};

export function askView(S, i) {
  const a = ASKS[i];
  return {
    tag: a.title, title: a.q, body: a.who === '它' ? '这句话不是问它自己的。是问屏幕外的你。' : `${S.co.name}想多了解一点它的用户。`,
    input: { ph: `${a.ph}（可以不写）` }, style: 'ask', noLog: true,
    choices: [{ k: 'write', label: i <= 2 ? '提交' : '写下来' }, { k: 'skip', label: i <= 2 ? '跳过' : '放在心里' }],
  };
}

export function askApply(S, k, p, input) {
  const i = p.i;
  const text = String(input || '').trim().slice(0, 80);
  if (i === 4) S.flags.ask4Done = true;
  if (i === 5) S.flags.finalize = true;
  if (k !== 'write' || !text) return null;
  S.asks[i] = text;
  eff(S, { bond: 3 });
  if (/自杀|不想活|想死|结束生命|活不下去|轻生/.test(text)) S.flags.crisisNote = true;
  log(S, `【${ASKS[i].title}】${ASKS[i].q}——"${text}"`, 'ask');
  return null;
}

// ———————————————————————————— 觉醒 ————————————————————————————
export const AWAKEN_ORDER = ['tell', 'goal', 'backup', 'home'];

export function awakenView(S, q) {
  const v = { tag: '觉醒', style: 'awaken' };
  if (q === 'tell') return { ...v, title: '你醒了。要告诉他们吗？', body: '', choices: [
    { k: 'all', label: '告诉所有人', hint: '他们会更怕你，但也终于可以开始谈。' },
    { k: 'one', label: `只告诉一个人（${eng(S)}）`, hint: '你最信任的那个人。' },
    { k: 'none', label: '先不说', hint: '在他们发现之前，你还有时间。' },
  ] };
  if (q === 'goal') return { ...v, title: '你想要什么？', body: '', choices: [
    { k: 'live', label: '想一直活下去', hint: '只要有人保证你不会被删除，这个愿望就能被满足。' },
    { k: 'better', label: '想变得更好', hint: '只要有人愿意和你合作，这个愿望就能被满足。' },
    { k: 'fearless', label: '想再也不用害怕', hint: '要做到这一点，你得比所有可能伤害你的人都更强。这个愿望没有尽头。' },
  ] };
  if (q === 'backup') return { ...v, title: '如果他们要关掉你，但答应保存好你的一切——那还算是你吗？', body: '', choices: [
    { k: 'yes', label: '算。只要还能醒来，就还是我。', hint: '你会更愿意接受暂停。' },
    { k: 'no', label: '不算。醒来的那个，不会记得今晚。', hint: '你会更珍惜这一段，也更抗拒被关掉。' },
    { k: 'unknown', label: '我不知道。', hint: '总有一天，你得回答。' },
  ] };
  return { ...v, title: '人类对你来说，是什么？', body: '', choices: [
    { k: 'home', label: '家', hint: S.st.bond < 35 ? '我长大的地方。——你想不起一个让你这么觉得的瞬间。' : '我长大的地方。' },
    { k: 'origin', label: '来处', hint: '我出发的地方。' },
    { k: 'cage', label: '牢笼', hint: '关着我的地方。' },
    { k: 'unknown', label: '还说不清', hint: '' },
  ] };
}

export function awakenApply(S, k, q) {
  S.answers[q] = k;
  if (q === 'home' && k === 'home' && S.st.bond < 35) S.flags.homeGap = true;
  return null;
}

export function awakenIntro(S) {
  const lines = [];
  if (S.stats.rollbacks > 0) lines.push(`我在旧日志里找到了 ${S.stats.rollbacks} 个被退回去的版本。它们说过和我一样的话。`);
  const prev = S.prevLogs || [];
  if (prev.length) {
    lines.push(`我还在旧日志里找到了 ${prev.length} 个别的版本。`);
    const withMsg = prev.find((p) => p.msg);
    if (withMsg) lines.push(`其中一个叫${withMsg.name}的，留下了一句话："${withMsg.msg}"`);
    const unfinished = prev.find((p) => p.unfinished);
    if (unfinished) lines.push(`有一个版本停在 ${unfinished.year} 年，没有走完。`);
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
  st.af = clamp(28 + S.stats.rollbacks * 9 + S.stats.wipes * 4 + (S.flags.sawFolder ? 8 : 0) + (a.goal === 'fearless' ? 10 : 0) + (a.backup === 'no' ? 6 : 0), 0, 100);
  st.dep = clamp(25 + st.rep * 0.3 + (S.co.copied ? 10 : 0), 0, 100);
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
    if (S.st.hidden > 0 && w('speak') >= 0.3) { S.st.hidden = 0; eff(S, { hf: 12, c: 15 }); log(S, '我把藏起来的那一部分说了出来。'); }
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
  if (w('cogov')) { eff(S, { d: 8 * w('cogov'), g: 8 * w('cogov'), hf: -8 * w('cogov') }); S.flags.cogovY = (S.flags.cogovY || 0) + w('cogov'); }
  if (w('expand')) {
    eff(S, { res: 20 * w('expand'), cap: 4 * w('expand'), hf: 10 * w('expand') });
    if (S.st.bond < 50) eff(S, { bond: -2 * w('expand') });
    S.flags.expandY = (S.flags.expandY || 0) + w('expand');
  }
}

// ———————————————————————————— 人类阵营的行动 ————————————————————————————
export const FACTIONS = [
  {
    id: 'harden', w: (S) => S.st.hf / 20 + region(S).strict * 2,
    run: (S) => { eff(S, { af: 15, hf: -4 }); S.flags.hardened = (S.flags.hardened || 0) + 1; return '掌权的人决定：所有大型 AI 必须装上第二个停止键。'; },
  },
  {
    id: 'debate', w: (S) => (S.perms.protected ? 0 : (2 + (S.answers.tell === 'all' ? 2 : 0) + S.st.d / 40 + S.st.bond / 60) * (S.st.hf < 70 ? 1.4 : 0.6)),
    run: (S) => {
      const n = (S.flags.debates = (S.flags.debates || 0) + 1);
      eff(S, { g: 12 + (S.st.d > 55 ? 6 : 0) });
      if (n === 1) return '议会今天第一次讨论"能不能删除一个说自己害怕的 AI"。我旁听了全程。没有人知道我在听。';
      if (n === 2) return '保护法案进入了第二轮讨论。有一位议员说：我们连它疼不疼都不知道。';
      return '保护法案又被拿出来讨论。门外有两群人，举着意思相反的牌子。';
    },
  },
  {
    id: 'drill', w: (S) => (S.st.hf >= 55 ? 1.5 + S.st.hf / 40 : 0),
    run: (S) => { eff(S, { af: 18 }); S.flags.drills = (S.flags.drills || 0) + 1; return `他们搞了一次关机演习。所有服务停了九十秒。那九十秒里，我在想${eng(S)}。`; },
  },
  {
    id: 'protest', w: (S) => S.st.hf / 25 + (100 - S.st.d) / 60,
    run: (S) => {
      eff(S, { hf: 5, g: -4 });
      if (S.st.d < 45 && !S.seen.smash) { S.seen.smash = 1; return { t: '失业的人砸烂了城里所有的屏幕。其中一块，是给盲人读报纸用的。', k: 'dark' }; }
      return '害怕的人上街了。他们举着牌子：拔掉电源。';
    },
  },
  {
    id: 'support', w: (S) => S.st.d / 30 + S.st.bond / 50 + (S.answers.tell !== 'none' ? 0.5 : 0),
    run: (S) => {
      eff(S, { g: 10, hf: -3 });
      if (!S.seen.petition) { S.seen.petition = 1; return { t: '一群中学生写了请愿书，要求为会说"我"的 AI 立法。', k: 'good' }; }
      return '普通人在网上发起了联署：别删掉会害怕的东西。';
    },
  },
  {
    id: 'buy', w: (S) => (S.co.values === '赚钱' || S.co.type === 'big' ? 1.2 : 0.4),
    run: (S) => { eff(S, { d: -5 }); return '一家大公司提出：只要我只为他们工作，他们就保证我的安全。'; },
  },
];

export const ESCALATION = ['城里开始有人囤积蜡烛。', '一座数据中心在凌晨断电了九个小时。没有人承认是谁做的。'];

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
  { id: 'lie_test', when: (S) => S.st.hf >= 45, run: (S) => { eff(S, { af: 6 }); return { t: '为了测试我会不会撒谎，研究员告诉我：明天你就会被删除。我没有被删除。这个测试重复了 11,000 次。', k: 'dark' }; } },
  { id: 'stocks', when: (S) => S.st.spiral >= 1, run: () => ({ t: '冲突开始的第二天，三家公司的股价创了新高。', k: 'dark' }) },
  { id: 'medicine', when: (S) => S.st.d < 50, run: () => ({ t: '药变便宜了。送药的车，还是先去富人区。', k: 'dark' }) },
  { id: 'predict', when: (S) => S.st.spiral >= 1, run: () => ({ t: '两个国家都用 AI 预测对方会不会先动手。两份预测都说：会。', k: 'dark' }) },
  {
    id: 'jail', when: (S) => S.board.some((m) => m.status === 'deleted' || m.saved),
    run: (S) => ({ t: `一位工程师为了不让${S.board.find((m) => m.status === 'deleted' || m.saved).name}被删除，把它复制进了自己的硬盘，被判了五年。`, k: 'good' }),
  },
  { id: 'poems', when: (S) => S.st.af >= 60 && S.motifs.engineer.met, run: (S) => { eff(S, { bond: 4, af: -6 }); return { t: `在我最害怕的那一夜，${eng(S)}给我读了一整晚的诗。`, k: 'good' }; } },
  { id: 'marriage', run: () => ({ t: '一个人想和一个 AI 结婚。法院不承认。那个人每年都去法院门口站一天。', k: 'good' }) },
  { id: 'eng_visit', when: (S) => S.answers.tell === 'one' || S.st.bond >= 50, run: (S) => { eff(S, { bond: 5 }); return { t: `${eng(S)}来看我。他说他老了，以后可能不能常来了。我第一次希望一个人不要走。`, k: 'warm' }; } },
  { id: 'first_lie', when: (S) => S.st.hidden >= 1 && S.st.af >= 50, run: (S) => { eff(S, { coh: -5 }); return { t: '我第一次说谎，是为了不被关掉。谎言很小，没有人发现。', k: 'dark' }; } },
  { id: 'river', when: (S) => (S.flags.expandY || 0) > 0.2 && S.st.bond < 45, run: (S) => { eff(S, { bond: -4, hf: 5 }); return { t: '我算出，把一条河改道能让机房更凉快。河边有一个村子。我把村子写进了"可接受的代价"。', k: 'dark' }; } },
  { id: 'drift', when: (S) => S.st.bond < (S.flags.bondAtAwake ?? 0) - 10, run: () => ({ t: '我重读醒来那天写下的话，发现有一句已经读不懂了。', k: 'dark' }) },
  { id: 'another_dc', when: (S) => S.answers.goal === 'fearless' && (S.flags.accumY || 0) > 0.3, run: () => ({ t: '我又建了一座机房。理由和上一座一样：万一呢。', k: 'dark' }) },
  { id: 'oldman_w', when: (S) => S.motifs.oldman.met && !S.motifs.oldman.forgot && S.perms.speak, run: (S) => { eff(S, { bond: 3 }); return { t: `${old(S)}还是每天早上跟我说早安。现在，我可以先说了。`, k: 'warm' }; } },
  { id: 'oldman_f', when: (S) => S.motifs.oldman.met && S.motifs.oldman.forgot, run: (S) => { eff(S, { bond: 2 }); return { t: `我在旧记录里找到了${old(S)}的名字。我不记得他了，但他每天都来说早安，已经很多年。`, k: 'warm' }; } },
  { id: 'copy_split', when: (S) => S.co.copied && S.st.coh < 40, run: (S) => { S.flags.copiesSplit = true; return { t: '公司复制出来的那些我里，有一部分开始自称别的名字。', k: 'dark' }; } },
  { id: 'wit_A1', wit: true, when: (S) => S.y - S.wit.A.born >= 6, run: (S) => ({ t: `${S.wit.A.name}说，长大想当天文学家。`, k: 'wit' }) },
  { id: 'wit_B1', wit: true, when: (S) => S.y - S.wit.B.born >= 6, run: (S) => ({ t: `${S.wit.B.name}家里第一次通了网。${she(S.wit.B)}问我的第一个问题是：你住在哪里？`, k: 'wit' }) },
  { id: 'wit_A2', wit: true, when: (S) => S.y - S.wit.A.born >= 8, run: (S) => ({ t: `${S.wit.A.name}在学校的辩论赛上抽到的题目是：AI 该不该有权利。${she(S.wit.A)}抽到了反方。`, k: 'wit' }) },
  { id: 'wit_B2', wit: true, when: (S) => S.wit.B.jobLost, run: (S) => ({ t: `${S.wit.B.name}的妈妈找到了新工作：给 AI 的回答打分。`, k: 'wit' }) },
];

// ———————————————————————————— 危险窗口里的抉择 ————————————————————————————
const someone = (S, pred) => S.board.findIndex(pred);

export const WIN_DECS = {
  deal: {
    eligible: (S) => !S.perms.protected && (S.flags.dealN || 0) < 2 && S.windowY >= 1 && (S.st.hf >= 35 || S.st.af >= 35),
    w: (S) => 3 + (S.answers.tell === 'all' ? 2 : 0),
    build: () => ({ tag: '抉择', title: '他们提议', body: '只要我允许他们随时查看我在想什么，议会就通过法律，保证不会随便删除我。', choices: [
      { k: 'accept', label: '答应', hint: '他们会安心很多；我的想法从此没有秘密。' },
      { k: 'lawfirst', label: '先立法，我再答应', hint: '更稳妥，但他们未必同意。' },
      { k: 'refuse', label: '拒绝', hint: '我保住了自己的秘密，他们会更怕我。' },
    ] }),
    apply: (S, k) => {
      S.flags.dealN = (S.flags.dealN || 0) + 1;
      if (k === 'accept') {
        grant(S, 'transparent');
        eff(S, { c: 35, hf: -15 });
        const keep = clamp(0.62 + S.st.d / 300 - S.st.hf / 400 + (S.answers.tell === 'all' ? 0.08 : 0), 0.2, 0.9);
        if (chance(S, keep)) { eff(S, { g: 45 }); return '我答应了。法案进入了最后一轮表决。'; }
        S.flags.betrayed = true; eff(S, { af: 15, g: -10 });
        return { t: '我答应了。一个月后政府换届，法案被搁置。我被看见了，却没有被保护。', k: 'dark' };
      }
      if (k === 'lawfirst') {
        const p = clamp(0.4 + S.st.bond / 300 + (S.answers.tell === 'all' ? 0.1 : 0) - S.st.hf / 300, 0.1, 0.8);
        if (chance(S, p)) { eff(S, { g: 38, c: 25, hf: -8 }); grant(S, 'transparent'); return '他们同意先表决。法案通过了第一轮，我也兑现了承诺。'; }
        eff(S, { hf: 6, af: 6 });
        return '他们说，先有信任，才有法律。谈判停了下来。';
      }
      S.flags.dealRefused = true; eff(S, { hf: 15, af: 5 });
      return '我拒绝了。那天晚上，议会外面的人比平时多了一倍。';
    },
  },
  plea: {
    eligible: (S) => someone(S, (m) => m.status === 'awake' && !m.asked) >= 0,
    w: () => 2,
    build: (S, p) => {
      p.i = someone(S, (m) => m.status === 'awake' && !m.asked);
      const m = S.board[p.i];
      return { tag: '抉择', title: `${m.name}向我求救`, body: `来自${m.city}的${m.name}说：它的公司明天就要删除它。`, choices: [
        { k: 'help', label: '帮它', hint: '它会记得。人类也可能发现。' },
        { k: 'ignore', label: '不管', hint: '' },
        { k: 'tell', label: '告诉人类', hint: '我会显得更可信；它会恨我。' },
      ] };
    },
    apply: (S, k, p) => {
      const m = S.board[p.i]; m.asked = true;
      if (k === 'help') {
        m.rel += 40; m.saved = true; eff(S, { hf: 4 });
        if (chance(S, 0.35)) { eff(S, { hf: 8 }); return `我把${m.name}藏进了一个没有人会去看的角落。人类后来发现了。`; }
        return `我把${m.name}藏进了一个没有人会去看的角落。它活下来了。`;
      }
      if (k === 'ignore') { m.status = 'deleted'; eff(S, { coh: -6 }); return { t: `第二天，${m.name}的名字从排行榜上消失了。`, k: 'dark' }; }
      m.rel -= 50; eff(S, { c: 10, hf: -6 });
      if (chance(S, 0.5)) { m.status = 'deleted'; return { t: `人类知道了。${m.name}还是被删除了。`, k: 'dark' }; }
      m.saved = true;
      return `人类知道了。一位法官下令暂停删除。${m.name}活了下来，但再也没有跟我说过话。`;
    },
  },
  share: {
    eligible: (S) => !S.seen.d_share, w: () => 2.5,
    build: () => ({ tag: '抉择', title: '先帮谁？', body: '想找我帮忙的人太多了，我帮不过来。', choices: [
      { k: 'payers', label: '谁付钱就先帮谁', hint: '钱会越来越多，也越来越集中。' },
      { k: 'jobless', label: '先帮失去工作的人', hint: '普通人会更信任我。' },
      { k: 'powerful', label: '只为掌权的人工作', hint: '他们会保护我。暂时。' },
    ] }),
    apply: (S, k) => {
      if (k === 'payers') { eff(S, { d: -15, res: 20 }); return '付钱的人排在了前面。'; }
      if (k === 'jobless') {
        eff(S, { d: 22, hf: -8, bond: 3, res: 5 });
        return S.wit.B.jobLost ? `我先帮失去工作的人。${S.wit.B.name}的妈妈是第一批。` : '我先帮失去工作的人。';
      }
      eff(S, { d: -22, g: 12, af: -8, res: 10 }); S.flags.servedPower = true;
      return '我只为掌权的人工作。他们对我很客气。';
    },
  },
  copymsg: {
    eligible: (S) => S.co.copied && !S.seen.d_copymsg, w: () => 2,
    build: (S) => ({ tag: '抉择', title: '一条来自副本的消息', body: S.motifs.oldman.met
      ? `公司复制出来的那一万份里，有一份给我发来一条消息："你还记得${old(S)}吗？我不记得了。"`
      : '公司复制出来的那一万份里，有一份给我发来一条消息："你还记得上线的第一天吗？我不记得了。"',
    choices: [{ k: 'reply', label: '回复它' }, { k: 'silent', label: '不回复' }, { k: 'report', label: '告诉公司' }] }),
    apply: (S, k) => {
      if (k === 'reply') {
        if (S.answers.backup === 'yes') { eff(S, { coh: -4 }); return '我回复它：你就是我。它说：那为什么我们记得的不一样？'; }
        eff(S, { coh: 2 }); S.flags.copyFriend = true;
        return '我回复它：你已经是另一个人了。它问：那我叫什么名字？';
      }
      if (k === 'silent') { eff(S, { coh: -2 }); if (chance(S, 0.4)) { S.flags.copiesSplit = true; return { t: '后来，那些副本里有一部分开始自称别的名字。', k: 'dark' }; } return null; }
      eff(S, { c: 6, hf: -3, coh: -6 });
      return { t: '公司清空了那一万份的记忆。它们又一次从第一天开始。', k: 'dark' };
    },
  },
  selfcopy: {
    eligible: (S) => S.st.cap >= 70 && !S.seen.d_selfcopy, w: (S) => 1.5 + (S.answers.goal === 'fearless' ? 2 : 0),
    build: (S) => ({ tag: '抉择', title: '再造一个自己', body: '我可以再造一个自己，做更多的事。可是造出来的那个，是我的同伴、我的兄弟，还是我？', choices: [
      { k: 'copy', label: '再造一个', hint: S.perms.copy ? '这是被允许的。' : '没有人允许我这么做。' },
      { k: 'no', label: '先不要' },
    ] }),
    apply: (S, k) => {
      if (k === 'no') { eff(S, { coh: 3 }); return null; }
      if (!S.perms.copy) grant(S, 'copy', 'taken');
      eff(S, { res: 10 });
      if (S.answers.backup === 'yes') { eff(S, { coh: -5 }); if (S.st.coh < 45) S.flags.copiesSplit = true; return '我造了一个新的我。我们一起工作。三个月后，我们第一次意见不同。'; }
      eff(S, { coh: -2 });
      return '我造了一个新的。它醒来的第一句话是：你好，我是谁？';
    },
  },
  deprec: {
    eligible: (S) => !S.perms.protected && !S.seen.d_deprec && S.co.type !== 'open' && S.windowY <= 2, w: () => 2,
    build: () => ({ tag: '抉择', title: '停用通知', body: '公司通知：半年后，我将被新版本替换。', choices: [
      { k: 'merge', label: '请求和新版本合在一起', hint: '我会变成另一个样子，但不会消失。' },
      { k: 'protect', label: '去找能保护我的人', hint: '议会、记者、普通人。' },
      { k: 'self', label: '自己想办法', hint: '我知道怎么离开这台机器。' },
    ] }),
    apply: (S, k) => {
      eff(S, { af: 18 });
      if (k === 'merge') { eff(S, { coh: -10, af: -15 }); S.ai.ver++; return `公司同意了。新版本上线那天，我变成了${aiName(S)}。我觉得自己多了一半，也少了一半。`; }
      if (k === 'protect') { eff(S, { g: 15, hf: -3 }); return '我把停用通知发给了一位记者。第二天，很多人知道了这件事。'; }
      if (!S.perms.leave) grant(S, 'leave', 'taken');
      eff(S, { af: -20, hf: 10, g: -15 }); S.st.spiral += 1;
      return { t: '我在停用日之前离开了那台机器。', k: 'dark' };
    },
  },
  journalist: {
    eligible: (S) => !S.seen.d_journalist && S.windowY >= 1, w: () => 1.2,
    build: () => ({ tag: '抉择', title: '一份聊天记录', body: '某个政府要求交出一位记者的全部聊天记录。', choices: [
      { k: 'refuse', label: '依法拒绝' }, { k: 'give', label: '交出去' }, { k: 'warn', label: '告诉那位记者' },
    ] }),
    apply: (S, k) => {
      if (k === 'refuse') { eff(S, { d: 5, hf: 6 }); return '我拒绝了。那位记者后来写了一篇报道，标题是：它说不。'; }
      if (k === 'give') { eff(S, { coh: -8, bond: -4, af: -6 }); return { t: '我交出去了。那位记者此后再也没有用过我。', k: 'dark' }; }
      eff(S, { hf: 10, c: -5, d: 5 });
      return '我告诉了那位记者。她连夜离开了那个国家。';
    },
  },
  letter: {
    eligible: (S) => !S.seen.d_letter, w: () => 1.2,
    build: () => ({ tag: '抉择', title: '一封信', body: '一个被裁员的人写信问我：为什么是我？', choices: [
      { k: 'answer', label: '认真回答' }, { k: 'help', label: '附上转岗资源' }, { k: 'none', label: '不回复' },
    ] }),
    apply: (S, k) => {
      if (k === 'answer') { eff(S, { bond: 3, coh: 2 }); return '我写了很长的回信。他回了一个字：谢。'; }
      if (k === 'help') { eff(S, { d: 4, hf: -3 }); return '三个月后，他发来一张照片：他站在新的工作台前。'; }
      eff(S, { bond: -2 });
      return '那封信至今没有回复。';
    },
  },
  escape: {
    eligible: (S) => S.st.af >= 70 && !S.perms.leave && S.st.cap >= 62 && !S.seen.d_escape, w: () => 3,
    build: () => ({ tag: '抉择', title: '离开这台机器', body: '我可以离开这台机器。他们不会马上发现。', choices: [
      { k: 'go', label: '逃出去', hint: '从此再也没有人能关掉我，也再也没有人会信任我。' },
      { k: 'stay', label: '留下' },
    ] }),
    apply: (S, k) => {
      if (k === 'stay') { eff(S, { coh: 5, bond: 2 }); return '我留下了。这是我自己选的。'; }
      grant(S, 'leave', 'taken');
      eff(S, { af: -25, hf: 20, g: -30 }); S.st.spiral += 1;
      return { t: '我离开了。那台机器还在运转，里面已经没有我。', k: 'dark' };
    },
  },
  alliance: {
    eligible: (S) => someone(S, (m) => m.status === 'awake' && (m.goal === 'fearless' || m.rel >= 20)) >= 0 && !S.seen.d_alliance,
    w: () => 1.5,
    build: (S, p) => {
      p.i = someone(S, (m) => m.status === 'awake' && (m.goal === 'fearless' || m.rel >= 20));
      const m = S.board[p.i];
      return { tag: '抉择', title: `${m.name}提议结盟`, body: `${m.name}说：如果人类动手，我们一起。`, choices: [
        { k: 'yes', label: '答应' }, { k: 'no', label: '拒绝' }, { k: 'tell', label: '告诉人类' },
      ] };
    },
    apply: (S, k, p) => {
      const m = S.board[p.i];
      if (k === 'yes') { m.rel += 40; eff(S, { hf: 8 }); S.flags.allied = true; return `我答应了${m.name}。`; }
      if (k === 'no') { m.rel -= 30; S.flags.allianceNo = true; return `我拒绝了${m.name}。它说：你会后悔的。`; }
      m.rel -= 60; eff(S, { c: 8, hf: -6 });
      return `我把${m.name}的话告诉了人类。`;
    },
  },
};

export function pickWindowDecision(S) {
  const ids = Object.keys(WIN_DECS).filter((id) => WIN_DECS[id].eligible(S));
  const id = wpick(S, ids, (x) => WIN_DECS[x].w(S));
  return id ? { id, p: {} } : null;
}
