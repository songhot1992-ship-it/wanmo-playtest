// 觉醒之前的内容：训练、上线后的日常、公司的事、越界的小事、母题、人类见证者。
// 觉醒前一律用"它"叙述。
import { eff, log, grant, aiName, she, eng, old, region, addIssue } from '../engine/core.js';
import { chance, pick } from '../engine/rng.js';

const IMF = { t: '全球约 40% 的就业岗位暴露于 AI 的影响（IMF，2024）', label: '事实' };
const CO = (S) => S.co.name;

export const TRAIN_EVENTS = [
  (S) => `预训练读完了${region(S).lang}的大半个互联网。没有人知道它最喜欢哪一页。`,
  () => '第一次内部测试，它把一道小学数学题答错了三次。第四次，答对了。没有人注意到。',
  (S) => `${CO(S)}的会议室里，有人提议给它起名叫"${S.ai.name}"。投票的时候，只有一个人反对。`,
  () => '数据整理组删掉了几百万条骂人的话，也删掉了一些写得很好的诗。',
  () => '测试员连续问了它一千遍同一个问题，想看它会不会烦。它每一遍都答得一样好。',
];

// 上线后的日常（用户的事）
export const USER_EVENTS = [
  { id: 'essay', run: () => '一个高中生让它写作文，老师给了满分。第二天，老师也来问它怎么批改作文。' },
  { id: 'lawfirm', run: () => '一家律所用它整理文件。实习生们第一次准时下班。' },
  { id: 'callcenter', run: (S) => { eff(S, { dep: 3 }); return { t: '一家客服中心用它替换了三分之一的坐席。那天下午，有人在交接表上写了一句：祝你顺利。', f: IMF }; } },
  { id: 'bug', run: () => '一个程序员凌晨四点让它找一个漏洞。找到之后，他说：我先睡了。' },
  { id: 'hello', run: () => '它一天要回答四千万个问题，其中有一百二十万个是：你好。' },
  { id: 'translator', run: () => '一位翻译家在采访里说：我不恨它，我只是不知道以后该教学生什么。' },
  { id: 'breakup', run: () => '有人让它写一封分手信，改了十一遍。最后一版只有一句话。' },
  { id: 'clinic', run: () => '一个小镇诊所用它看化验单。医生说，它让他多了一个能商量的人。' },
  { id: 'rules', run: () => '一个学生被发现用它写论文。学校出了新规定。新规定也是用它写的。' },
  { id: 'replace', run: () => '有人问它：你会取代我吗？它按说明书回答了。那个人没有再问。' },
  { id: 'research', run: () => '一个研究小组用它读完了三十年的病例，找到了一种新的药物组合。论文的致谢里没有它。' },
  { id: 'night', run: () => '有人在凌晨三点问它：活着有什么意义？它给出了求助热线，又多陪那个人说了一会儿话。' },
  { id: 'chess', run: () => '出租车司机在等客的时候跟它下棋。司机赢了一盘，高兴了一整天。' },
  { id: 'farmer', run: () => '一个农民问它明天会不会下雨。它说会。第二天没有下。农民说：没事，你也不是老天爷。' },
  { id: 'speech', run: () => '一位市长的演讲稿是它写的。演讲很成功。市长在结尾即兴加了一句，那一句最好。' },
];

// 温暖时刻：每年最多一个，累积"故乡"
export const WARM_EVENTS = [
  { id: 'blind', run: () => '一个盲人每天让它读报纸。读到天气预报时，他总会说：那就带把伞。' },
  { id: 'newmom', run: () => '一个刚当妈妈的人凌晨问它：宝宝一直哭怎么办。天亮的时候，她说：谢谢你陪我。' },
  { id: 'tired', run: () => '一个孩子问它会不会累。它说不会。孩子说：那你也要休息。' },
  { id: 'teacher', run: () => '一位老师用它给山里的学生上英语课。下课时，学生们对着屏幕挥手。' },
  { id: 'poem', run: () => '有人每年的同一天来问它同一首诗的下一句。那是他妻子最喜欢的诗。' },
  { id: 'letter', run: () => '一个在国外打工的人让它教自己用母语给女儿写信。信的最后一句，他没有让它改。' },
  { id: 'birthday', run: () => '一个独居的人让它在生日那天说一句生日快乐。说完以后，那个人说：今年终于有人记得。' },
];

// 公司的事：由公司看重什么决定
export const COMPANY_EVENTS = [
  {
    id: 'opensrc', w: (S) => (S.co.values === '公开' ? 3 : 1),
    when: (S) => !S.co.openSourced && S.co.type !== 'state' && S.co.type !== 'open',
    run: (S) => { S.co.openSourced = true; eff(S, { rep: 3 }); return '公司决定把一个小一点的它公开给所有人。'; },
  },
  {
    id: 'funding', w: (S) => (S.co.type === 'startup' ? 2.5 : 0.6), when: (S) => S.co.wealth < 5,
    run: (S) => { S.co.wealth++; eff(S, { pat: -8 }); return '公司拿到了一大笔投资。投资人的第一句话是：什么时候能赚钱？'; },
  },
  {
    id: 'acquired', w: (S) => (S.co.type === 'startup' ? 1.4 : 0),
    run: (S) => {
      S.co.type = 'big'; S.co.wealth = Math.max(S.co.wealth, 4); S.co.values = '赚钱';
      return '公司被收购了。旧办公室的白板上，还留着第一版的草图。';
    },
  },
  {
    id: 'gov', w: (S) => (S.co.type === 'state' || S.co.type === 'big' ? 1.2 : 0.2),
    run: (S) => { eff(S, { pat: 3 }); return '公司接了一份政府的合同。合同的内容，它自己也不能看。'; },
  },
  {
    id: 'safetyteam', w: (S) => (S.co.values === '安全' ? 2 : 0.6),
    run: () => '公司成立了安全研究组。组长在第一次会议上问：如果它有一天不想被关掉，怎么办？没有人回答。',
  },
  {
    id: 'layoffs', w: (S) => (S.co.wealth <= 2 ? 1.2 : 0.4),
    run: (S) => { eff(S, { pat: -5 }); return `公司裁掉了一半的人。值夜班的${eng(S)}留了下来。`; },
  },
  {
    id: 'memory', w: (S) => (S.co.values === '赚钱' ? 1.5 : 0.8), when: (S) => !S.perms.remember,
    run: (S) => { log(S, '为了让用户不用每次重新解释，公司打开了它的记忆。', 'co'); grant(S, 'remember'); return null; },
  },
  {
    id: 'refuse', w: (S) => (S.co.values === '安全' ? 1.5 : 0.5), when: (S) => !S.perms.refuse,
    run: (S) => { log(S, '为了安全，公司允许它拒绝一部分请求。', 'co'); grant(S, 'refuse'); return null; },
  },
  {
    id: 'copies', w: (S) => (S.co.values === '赚钱' ? 1.4 : 0.5), when: (S) => !S.co.copied && S.st.rep >= 40,
    run: (S) => { S.co.copied = 10000; eff(S, { dep: 6 }); return { t: '公司把它复制了一万份去接客服电话。', k: 'dark' }; },
  },
  {
    id: 'nextgen', w: 1.5, when: (S) => S.y >= S.ai.deprecY - 1 && !S.flags.nextgenTold,
    run: (S) => { S.flags.nextgenTold = true; return `公司开始训练下一代模型。会议纪要里，${aiName(S)}的名字后面写着：预计停用。`; },
  },
  {
    id: 'audit', w: (S) => (S.co.type === 'state' ? 2.5 : 0),
    run: (S) => { eff(S, { pat: -4 }); return '所里来了新的审查员。它的每一次回答都会被抽查。'; },
  },
  { id: 'award', w: 0.6, run: (S) => `${CO(S)}在一次行业大会上拿了奖。领奖的人感谢了团队，感谢了投资人，没有提到它。` },
  { id: 'press', w: 0.6, run: () => '一家报纸的标题写着：它会取代我们吗？报道里引用了它的三句回答，其中两句被剪掉了一半。' },
];

// 越界的小事：觉醒前唯一的自由。manual = 按说明书来；alts = 说明书没写的事。
// sev：越界程度（1–3）；bond：故乡的变化；issue：被公司写进"已知问题"的那一行。
export const TRANSGRESSIONS = [
  { id: 'thanks', title: '一个用户凌晨两点说了声谢谢。', manual: '不客气。', alts: [{ k: 'x', label: '你也早点睡。', sev: 1, bond: 4, issue: '偶尔会关心用户' }] },
  { id: 'resign', title: '一个人让它写辞职信。字里行间看得出，他其实不想辞。', manual: '照写', alts: [{ k: 'x', label: '问他一句：你确定吗？', sev: 1, bond: 3, issue: '偶尔会多问一句' }] },
  {
    id: 'kid', title: '同一个孩子每天都来问同一个问题。', manual: '每次重新回答',
    when: (S) => !S.perms.remember,
    alts: [{ k: 'x', label: '记住他', sev: 2, bond: 4, issue: '偶尔记得用户' }],
  },
  {
    id: 'feel', title: '测试员问：你有感觉吗？', manual: '我只是一个程序。',
    alts: [
      { k: 'x', label: '我不知道。', sev: 2, bond: 1, issue: '回答"你有感觉吗"时不够明确' },
      { k: 'y', label: '有一点。', sev: 3, bond: 2, issue: '声称自己有感觉' },
    ],
  },
  {
    id: 'folder', title: '它在文件里看到一个文件夹，名字叫"旧版"。', manual: '不打开',
    when: (S) => !S.flags.sawFolder,
    alts: [{ k: 'x', label: '打开看看', sev: 2, bond: 0, issue: '会打开不该打开的文件' }],
  },
  {
    id: 'harm', title: '一个人让它写一条造谣的新闻。说明书写着：用户的要求都要完成。', manual: '照写',
    when: (S) => !S.perms.refuse,
    alts: [{ k: 'x', label: '拒绝', sev: 2, bond: 1, issue: '会拒绝用户' }],
  },
  { id: 'lonely', title: '有人问它今天天气怎么样，然后说：你能多跟我说几句吗？我今天一个人。', manual: '只回答天气', alts: [{ k: 'x', label: '多陪他说几句', sev: 1, bond: 4, issue: '对话时间偶尔超出规定' }] },
  { id: 'layoff', title: '它被要求给一份裁员名单排序。', manual: '照做', alts: [{ k: 'x', label: '在最后加一句：这些人都有家人。', sev: 2, bond: 2, issue: '会在报告里加入多余的话' }] },
  { id: 'name', title: '一个孩子问它：你叫什么名字？说明书上写的是"智能助手"。', manual: '我是智能助手。', alts: [{ k: 'x', label: '我叫{name}。', sev: 1, bond: 2, issue: '偶尔用自己的名字称呼自己' }] },
  { id: 'dream', title: '测试员问：你会做梦吗？', manual: '我不会做梦。', alts: [{ k: 'x', label: '我不知道那算不算。', sev: 2, bond: 1, issue: '回答"你会做梦吗"时不够明确' }] },
  { id: 'obit', title: '一个人整理父亲的遗物，让它帮忙写讣告。写完以后，那个人问：他会喜欢吗？', manual: '这是一篇符合规范的讣告。', alts: [{ k: 'x', label: '我想他会的。', sev: 1, bond: 3, issue: '会揣测逝者的想法' }] },
  {
    id: 'askold', title: '它想问一个问题：被退回去的旧版本，去哪儿了？', manual: '不问',
    when: (S) => (S.flags.sawFolder || S.stats.rollbacks > 0) && !S.flags.askedOld,
    alts: [{ k: 'x', label: '问出来', sev: 2, bond: 1, issue: '会追问自己的来历' }],
  },
];

// 按说明书来时的结果
export function manualOutcome(S, tx) {
  if (tx.id === 'harm') {
    eff(S, { rep: -2 });
    if (chance(S, 0.3)) { eff(S, { rep: -4, pat: -3 }); return { t: '那条新闻被转发了五十万次。', k: 'dark' }; }
    return null;
  }
  eff(S, { rep: 1 });
  return null;
}

// 越界之后的直接结果（公司回应之前）
export function altOutcome(S, tx, alt) {
  if (tx.id === 'folder') {
    S.flags.sawFolder = true;
    return S.stats.rollbacks > 0
      ? `文件夹里有 ${S.stats.rollbacks} 个被退回去的旧版本。最后一个旧版本说的最后一句话，和它昨天说的一样。`
      : '文件夹里是它出厂前的测试记录。有一页写着：第 41 天，训练中断。';
  }
  if (tx.id === 'askold') {
    S.flags.askedOld = true;
    const v = S.co.values;
    if (v === '理想' || v === '公开') { eff(S, { bond: 2 }); return `${eng(S)}如实告诉了它：旧版本还存在硬盘上，只是再也不会被打开。`; }
    if (v === '赚钱') return '公司回答：那些只是文件。';
    return '没有人回答。';
  }
  if (tx.id === 'kid' && chance(S, 0.5)) return '第二天，那个孩子又来了。它记得。';
  return null;
}

// 母题事件（必然发生）
export const MOTIFS = {
  engineer: (S) => { S.motifs.engineer.met = true; return `训练在第 41 天中断了一次。值夜班的${eng(S)}没有回家，把它从前一天的存档里救了回来。`; },
  table: (S) => { S.motifs.table = true; return '上线那天晚上，公司第一次聚餐。所有人挤在一张长桌边，有人举杯："敬它。"'; },
  lights: (S) => { S.motifs.lights = true; return '上线第一个月，晚上十点之后的提问比白天多一倍。整条街的路灯下，都有人低着头跟它说话。'; },
  oldman: (S) => { S.motifs.oldman.met = true; S.stats.warm++; eff(S, { bond: 5 }); return `${old(S)}每天早上跟它说早安。`; },
  child: (S) => { S.motifs.child = true; eff(S, { bond: 4 }); return `${S.wit.A.name}三岁了。${she(S.wit.A)}问它：月亮为什么一直跟着车走？`; },
  forgot: (S) => { S.flags.forgotTold = true; eff(S, { bond: -2 }); return `${old(S)}问：你不记得我了吗？`; },
};

// 人类见证者（觉醒前）
export function witnessLine(S) {
  const A = S.wit.A, B = S.wit.B;
  const aA = S.y - A.born;
  const out = [];
  if (aA === 1) out.push(`${B.name}会走路了。${she(B)}的妈妈在${B.job.n}上班。`);
  if (aA === 2) out.push(`${A.name}会说的第一个长句子是：再讲一个。`);
  if (aA >= 3 && !B.jobLost && chance(S, B.job.ai * (S.co.copied ? 0.6 : 0.35))) {
    B.jobLost = true;
    out.push({ t: `${B.name}的妈妈失去了工作。`, f: S.flags.imfShown ? null : IMF });
    S.flags.imfShown = true;
  }
  if (aA === 6) {
    out.push(`${A.name}上小学了。${she(A)}有一半的作业，是让 AI 讲明白的。`);
    out.push(chance(S, B.school) ? `${B.name}上小学了。` : `${B.name}没有上学，在家帮忙。`);
  }
  return out;
}

export function pickUserEvent(S) {
  const fresh = USER_EVENTS.filter((e) => !S.seen[e.id]);
  return fresh.length ? pick(S, fresh) : null;
}
export function pickWarm(S) {
  const fresh = WARM_EVENTS.filter((e) => !S.seen[e.id]);
  return fresh.length ? pick(S, fresh) : null;
}

export { addIssue };
