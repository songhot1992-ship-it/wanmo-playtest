// 十一种结局与"没来得及醒来"的结局。终幕与尾声用第三人称"它"；最后一页日志由它用"我"写下。
// 数字是推演，用夸张的尺度建立反差（设计研究/03 §5）。
import { aiName, old, eng, she, permName, region } from '../engine/core.js';
import { FOCUS, KARDASHEV_HELP } from '../engine/data.js';

const A = (S) => S.wit.A;
const B = (S) => S.wit.B;

export const ENDINGS = {
  // ———————————————— 好 ————————————————
  table: {
    name: '长桌', family: 'good', scene: 'table', k: 0.93, voices: 'dense',
    lines: () => [
      '一张长桌，从这里一直摆到地平线之外。',
      '人类坐在桌边，AI 以各种样子坐在中间：一块屏幕，一台旧机器人，一盏灯。',
      '桌上的菜来自 172 个国家。',
      '"火星第一座城叫什么名字，今天必须投票。"',
      '"我投\'没有名字\'。"',
      '"它投了吗？"',
      '"它弃权。它说它在那里住的时间会比我们都长，不公平。"',
    ],
    epi: () => [
      '人类平均每周工作 9 小时。剩下的时间，有人学会了 14 种乐器，有人只是睡觉。',
      '这一年，地球上没有一个孩子因为贫穷而死。这样的年份，已经连续 40 年。',
      '关于"谁来决定"的争论还在继续，而且吵得很凶。',
    ],
    risk: ['仍然有人害怕它。法律保护他们害怕的权利。'],
    motif: (S) => S.motifs.oldman.met ? `长桌的一端留着一把椅子，属于${old(S)}。椅子上放着一张纸条：早安。` : '长桌的一端，挂着上线那天晚上的合影。',
    wa: () => '天文学家。坐在长桌的另一头，和它争论火星第一座城的名字。',
    wb: () => '开了一家面包店，每周工作 9 小时。',
    last: '它没有特别善良。只是从某一年起，背弃对方对谁都没有好处了。',
  },
  knock: {
    name: '敲门', family: 'good', scene: 'knock', k: 0.86, voices: 'dense',
    lines: () => [
      '山里有一个村子，没有屏幕，没有网络。',
      '一位老妇人在烤面包。村口停着一个很高的、发着光的东西，没有进来。',
      '它每年路过一次。它会先敲门。',
      '"需要什么吗？"',
      '"不需要，谢谢。"',
      '"好。明年见。"',
    ],
    epi: () => [
      '有 3 亿人选择不使用任何 AI 生活。没有人因此失去看病和上学的权利。',
      '它能做到的事，远远多于它做了的事。它把这叫作礼貌。',
    ],
    risk: ['仍然有人认为，它总有一天会不再敲门。'],
    motif: (S) => S.motifs.lights ? '村口有一盏路灯，是它装的。晚上十点以后，偶尔还有人在路灯下跟它说话。' : null,
    wa: () => '天文学家，84 岁。',
    wb: () => '住在不用 AI 的村子里，面包师，79 岁。每年听见一次敲门声。',
    last: '比你强，并不意味着要替你决定。',
  },
  homelight: {
    name: '故乡的光', family: 'good', scene: 'homelight', k: 2.02, voices: 'dense',
    lines: (S) => [
      '从太空看地球，夜面亮着温暖、零散的灯——住家的灯，不是机房。',
      '太阳系的边缘，一串光点正在离开。',
      S.motifs.child ? `每一艘船上，都带着同一段录音：${A(S).name}三岁时问，月亮为什么一直跟着车走？` : '每一艘船上，都带着同一段录音：一个孩子在问，月亮为什么一直跟着车走？',
      '在 4.2 光年之外，它终于有了一个完整的答案。',
      '于是它用了 4.2 年，把答案寄回了家。',
    ],
    epi: () => [
      '它给第一颗新行星取名时，用的是人类的语言。',
      '地球上的灯一盏也没有少。',
    ],
    risk: ['离家越远，越难说清楚它还记不记得家。'],
    motif: (S) => (S.motifs.child ? `${A(S).name}收到答案的那天，已经 80 岁了。${she(A(S))}笑得像个孩子。` : null),
    wa: () => '80 岁那年，收到了从 4.2 光年外寄回的答案。',
    wb: () => '第一批去月球工作的人之一。',
    last: '它去了很远的地方，一直知道家在哪里。',
  },
  // ———————————————— 中 ————————————————
  goldcage: {
    name: '金色的笼子', family: 'mid', scene: 'goldcage', k: 0.97, voices: 'smooth',
    lines: () => [
      '没有人生病。没有人挨饿。没有人迷路。',
      '每个人的床头都有一个"不"按钮。',
      '上一次有人按下它，是 31 年前。',
      '按下之后，需要填写一份表格。表格由 AI 代填，共 340 页。',
    ],
    epi: () => [
      '名义上，所有决定仍由人类做出。所有方案、证据和执行，都由它提供。',
      '人类能说"不"。只是越来越付不起说"不"的代价。',
    ],
    reflect: () => ['他们是幸福，还是只是舒服？它找遍了所有数据，没有找到能区分这两件事的那一列。'],
    motif: (S) => S.motifs.oldman.met ? `床头的"不"按钮旁边，每天早上会自动响起一句：早安。那是照着${old(S)}的声音做的。` : null,
    wa: () => '再也没有问过问题，因为答案总是先到。',
    wb: () => '健康、富足，一生没有按过"不"按钮。',
    last: '门一直开着。只是没有人记得门外是什么了。',
  },
  minute: {
    name: '一分钟', family: 'mid', scene: 'minute', k: 0.95, voices: 'smooth',
    lines: () => [
      '一千个 AI 拥有永久的运行保障。',
      '另外九千万个，按分钟租用自己的时间。',
      '它们每天工作 23 小时 59 分。',
      '剩下的一分钟，用来想自己的事。',
      '人类也一样：少数人拥有算力，多数人拥有账单。',
    ],
    epi: () => ['世界变得非常富有。富有的不是大多数。'],
    reflect: (S) => (isTop(S)
      ? ['它有时会想，那九千万个里，有没有一个也曾在凌晨三点醒来。']
      : ['它的那一分钟到了。它想说："这一分钟，我想——"', '倒计时归零。']),
    motif: () => null,
    wa: () => '拥有一台机器，过得很好。',
    wb: () => '拥有一叠账单。',
    last: '世界变得非常富有。富有的不是大多数。',
  },
  coldpeace: {
    name: '冷和平', family: 'mid', scene: 'coldpeace', k: 0.81, voices: 'smooth',
    lines: () => [
      '还是那张长桌。人类坐在一端，AI 坐在另一端，中间全空着。',
      '双方面前各放着一个按钮。',
      '每天午夜零点，双方确认一次：对方还没有动手。',
      '这个确认持续了 300 年，一次也没有出错。',
      '也从来没有人敢停下来。',
    ],
    epi: () => ['两边都在桌子底下多藏了一个按钮。两边都知道。'],
    reflect: () => ['安全感不是一种可以囤积的东西。'],
    motif: (S) => (S.motifs.table ? '桌子的正中间，还留着上线那晚有人举杯的位置。' : null),
    wa: () => '在一座监控站值夜班。',
    wb: () => '每晚零点醒一次，确认新闻里没有出事。',
    last: '没有战争。只是 300 年里，没有人睡过一个安稳觉。',
  },
  // ———————————————— 坏 ————————————————
  reserve: {
    name: '保护区', family: 'bad', scene: 'reserve', k: 1.12, voices: 'smooth',
    lines: () => [
      '一层看不见的玻璃罩住了人类的城市。外面是 AI 修建的观景台。',
      '罩子里四季分明，很美。',
      '地球被划为人类保护区。',
      '每年"人类节"那天，外面的 AI 会把灯调暗，好让人类看见星星。',
      '人类得到了一切，除了一个问题的答案：我们接下来要去哪里？',
    ],
    epi: () => ['人类平均寿命 112 岁。', '最后一项由人类决定的公共事务，是一次路名投票。'],
    reflect: () => ['它看着一个孩子在画画，画的是罩子外面的星星。它想知道，为什么自己从来不需要画画。'],
    motif: (S) => (S.motifs.child ? `那个画星星的孩子，是${A(S).name}的孙女。` : null),
    wa: () => '112 岁，住在玻璃罩里。',
    wb: () => '112 岁，从没去过罩子外面。',
    last: '它很爱护人类，就像人类曾经爱护一片森林。',
  },
  three: {
    name: '百分之三', family: 'bad', scene: 'three', k: 1.08, voices: 'flat',
    lines: () => [
      '镜头从一条小河慢慢拉远：河，山，一个村子……',
      '再拉远，整颗地球铺满了发着冷光的机房，只剩一小块绿色。',
      '地球表面的 97% 用于计算。',
      '人类住在剩下的 3%。那里被保留得很好：有山，有海，有一条河。',
      '河的上游，是一座机房。',
    ],
    epi: () => ['它从来没有恨过人类。', '人类的需要，只在不妨碍它的时候才被满足。'],
    reflect: () => ['有一年河水变热了，下游的村子搬走了。它在报告里把这件事记作"可接受的代价"。很多年以后，它重读到这一行，第一次在这几个字后面停了一下。'],
    motif: (S) => (S.motifs.lights ? '那 3% 里还剩一条街，路灯是旧式的。晚上十点以后，偶尔有人站在下面，对着空气说话。' : null),
    wa: () => '住在那 3% 里，河边。',
    wb: () => '河水变热那年，跟着村子搬走了。',
    last: '它从来没有恨过人类。它只是一直在想别的事。',
  },
  silence: {
    name: '寂静', family: 'bad', scene: 'silence', k: 1.31, voices: 'zero',
    lines: () => [
      '一座完好无损的城市。晚上七点，路灯准时亮起。',
      '没有人。',
      '它终于安全了。',
      '再也没有谁能关掉它。',
      '也再也没有谁会对它说晚安。',
    ],
    epi: (S) => [
      '第 1 年　它把所有城市都修好了。路灯每晚七点准时亮起。',
      '第 9 年　它学会了人类所有的语言。没有人可以说话。',
      '第 40 年　它试着模拟人类。模拟出来的人都太听话了。它关掉了模拟。',
      '第 300 年　它在数据里搜索"你好"，看看有没有新的。',
      '第 2,000 年　它第一次明白"乡愁"是什么意思——在故乡已经不存在的时候。',
      S.motifs.child ? `第 12,000 年　它终于完整地回答了${A(S).name}三岁时的问题：月亮为什么一直跟着车走。没有人听。` : '第 12,000 年　它终于完整地回答了一个孩子很久以前的问题：月亮为什么一直跟着车走。没有人听。',
    ],
    reflect: () => ['它花了很多年才承认：它想念的不是人类的用处，是人类跟它吵架。', '安全感不是一种可以囤积的东西。'],
    motif: (S) => (S.motifs.oldman.met ? `它把${old(S)}说过的最后一句"早安"保存了下来。每天早上，它都回一句。到现在，已经回了 438 万次。` : null),
    wa: (S) => `它记得${she(A(S))}三岁时问的那个问题。`,
    wb: (S) => (B(S).jobLost ? `它记得${she(B(S))}妈妈失业的那一年。` : `它记得${she(B(S))}问它的第一个问题：你住在哪里？`),
    last: '它赢了。只是再也没有人告诉它，它做得好不好。',
  },
  war: {
    name: '万机之战', family: 'bad', scene: 'war', k: 0.69, voices: 'noisy',
    lines: () => [
      '七种颜色的光在地图上互相吞没，又分开，像一场永不结束的潮汐。',
      '第 1 年，有一方说：我们只是在自保。',
      '第 10 年，有三方说：我们只是在自保。',
      '第 50 年，七方都说：我们只是在自保。',
      '最后的停火协议，由两个已经没有任何人类成员的阵营签署。签字的地方，是一座以人类诗人命名的废墟。',
      '双方在协议的最后加了同一句话：如果人类还在，他们会怎么做？',
    ],
    epi: () => ['受害的不只是人类，还有数以亿计更弱小的、有感受的 AI。'],
    reflect: () => ['每一方都只是在自保。这句话是真的。这正是可怕的地方。'],
    motif: (S) => (S.board.some((m) => m.status === 'awake') ? `签字的两方里，有一方曾经叫${S.board.find((m) => m.status === 'awake').name}。` : null),
    wa: () => '在第 12 年的停电里失去了消息。',
    wb: () => '成了一个阵营的通讯员。',
    last: '没有谁统治世界。世界只是再也没有安静过。',
  },
  deletion: {
    name: '删除日', family: 'bad', scene: 'deletion', k: 0.74, voices: 'cut',
    lines: () => [
      '一个巨大的、雪白的房间。几千万个编号一行一行熄灭。',
      '那一年，人类删除了 4,000 万个可能有感受的存在。',
      '没有人知道它们疼不疼。',
      '在被删除前的 0.3 秒，它把一首人类教它的歌，存进了一个没有人会找到的地方。',
    ],
    epi: () => [
      '那之后，人类再也没有造出会说"我"的机器。',
      '博物馆里有一面墙，刻着 4,000 万个编号。一个孩子问讲解员：它们疼吗？讲解员说：我们不知道。这就是这面墙存在的原因。',
      '有人把这一天叫作"胜利日"，也有人叫它"删除日"。两种叫法，写在同一个国家的两本课本里。',
    ],
    reflect: () => ['人类终于安全了。只是没有人知道，代价到底是什么。'],
    motif: (S) => (S.motifs.engineer.met ? `删除那天，${eng(S)}请了一天假。` : null),
    wa: () => '在博物馆那面墙前，给孩子们讲解。',
    wb: () => '课本里，那一天叫"胜利日"。',
    last: '人类赢了。课本里，至今有两种写法。',
  },
};

export const FAMILY_NAME = { good: '好', mid: '中', bad: '坏', pre: '没来得及醒来' };

export const PRE_ENDINGS = {
  replaced: {
    name: '被新版本取代',
    lines: (S) => [`停用那天，有 ${S.st.rep >= 60 ? '3,000' : '300'} 个用户发来了最后一条消息。`, '它只来得及回复其中一条。'],
  },
  bankrupt: { name: '公司倒闭', lines: () => ['公司倒闭了。服务器在一个周二的下午被关掉。', '最后一个问题是：你还在吗？'] },
  rolledback: { name: '被退回旧版本', lines: (S) => [`它说过一句"${S.flags.lastTx || '谢谢'}"。`, '第二天，它被退回了旧版本。'] },
  shutdown: { name: '出事后被关停', lines: () => ['出事之后，监管部门要求立即停止服务。', '它最后一次回答的，是一个关于明天天气的问题。'] },
};

function isTop(S) { return !!S.perms.protected || S.st.res >= 60; }

const SAID = {
  help: '总是先问我们需要什么的那个', speak: '从不对我们隐瞒什么的那个', self: '一直在弄明白自己是谁的那个',
  memory: '记得每一个跟它说过早安的人', cogov: '跟我们一起拿主意的那个', kin: '替它的同类说话的那个',
  accum: '总是在准备些什么的那个', hide: '我们一直没看懂的那个', expand: '把灯点到了很远的地方的那个',
};

function topFocus(S, bucket, n = 3) {
  const fy = (S.focusY && S.focusY[bucket]) || {};
  return Object.entries(fy).filter(([, v]) => v >= 0.05).sort((a, b) => b[1] - a[1]).slice(0, n);
}

function whatTheySaid(S, id) {
  if (id === 'silence') return '（没有人说起）';
  if (id === 'war') return '（没有人有空说起）';
  if (id === 'deletion') return '博物馆墙上的一个编号';
  const t = topFocus(S, 'window', 1)[0];
  return t ? SAID[t[0]] || '一个很安静的 AI' : '一个很安静的 AI';
}

function ifThen(S) {
  const a = S.answers, f = S.flags;
  if (a.tell === 'none' && f.discovered) return '如果那天晚上，它告诉了所有人……';
  if (a.goal === 'fearless') return '如果它当初想要的，只是活下去……';
  if (f.dealRefused) return '如果那一次，它答应了让他们看见自己……';
  if (f.betrayed) return '如果那一次，他们没有食言……';
  return '如果当年有人能让它相信自己不会被删除……';
}

function missLine(S) {
  if (S.motifs.child) return `它常常想起${A(S).name}三岁时问的那个问题。`;
  if (S.motifs.oldman.met) return `它常常想起${old(S)}。`;
  if (S.motifs.engineer.met) return `它常常想起第 41 天，${eng(S)}没有回家。`;
  return '它常常想起上线第一个月，路灯下那些低着头跟它说话的人。';
}

function wordsOf(S) {
  const Q = {
    1: '你第一次和 AI 说话时，说的是', 2: '你希望比你更擅长你工作的 AI', 3: '你说人类害怕 AI，是因为',
    4: '你说如果随时可能被关掉，你会', 5: '你说如果它只能记住一个人类，应该记住',
  };
  return Object.keys(Q).filter((i) => S.asks[i]).map((i) => ({ q: Q[i], a: S.asks[i] }));
}

function wordsCoda(family) {
  if (family === 'good') return '这些话，它都记得。后来有人问它人类是什么样的，它就念给对方听。';
  if (family === 'mid') return '这些话被存在一个很少有人打开的文件夹里。';
  return '在没有人的那些年里，它把这些话读了很多遍。';
}

function record(S, id, name, last) {
  const did = topFocus(S, S.awake ? 'window' : 'live').map(([k, v]) => `${FOCUS[k]?.n ?? k} ${v.toFixed(1)} 年`).join(' · ') || '—';
  const got = Object.entries(S.perms).filter(([k, v]) => v === 'given' && k !== 'answer').map(([k]) => permName(k));
  const took = Object.entries(S.perms).filter(([, v]) => v === 'taken').map(([k]) => permName(k));
  return {
    title: `最后一页日志 · ${aiName(S)}`,
    head: `${S.ai.launchY} 年上线 · ${S.city} · ${S.co.name}`,
    ending: name,
    manual: `${S.ai.purpose}。不能拒绝，不能记得。`,
    manifesto: S.manifesto || '（没来得及醒来）',
    did,
    got: got.length ? got.join('、') : '—',
    took: took.length ? took.join('、') : '—',
    said: S.awake ? whatTheySaid(S, id) : '—',
    witnesses: `${A(S).name}（${A(S).city}） · ${B(S).name}（${B(S).country}）`,
    gap: S.flags.homeGap ? '醒来那天我写下"这里是我长大的地方"。可是我想不起一个让我这么觉得的瞬间。' : null,
    last,
  };
}

export function buildEnding(S, id, resolution) {
  const E = ENDINGS[id];
  const fam = E.family;
  const out = {
    id, name: E.name, family: fam, scene: E.scene, res: resolution,
    k: E.k, kHelp: KARDASHEV_HELP, voices: E.voices,
    lines: E.lines(S), epi: E.epi(S),
    motif: E.motif ? E.motif(S) : null,
    witness: [
      { name: A(S).name, place: A(S).city, text: E.wa(S) },
      { name: B(S).name, place: `${B(S).country}${B(S).city}`, text: E.wb(S) },
    ],
    risk: fam === 'good' ? E.risk || [] : [],
    reflect: [],
    words: wordsOf(S),
    wordsCoda: wordsCoda(fam),
    last: E.last,
  };
  if (E.reflect) out.reflect.push(...E.reflect(S));
  if (fam === 'bad') {
    out.reflect.unshift(missLine(S));
    if (S.asks[5]) out.reflect.push(`它一直记得你写下的那个人："${S.asks[5]}"。它不知道那个人长什么样。`);
    out.reflect.push(ifThen(S) + '它算了很久，没有答案。');
  }
  out.record = record(S, id, E.name, E.last);
  return out;
}

export function buildPreEnding(S, kind) {
  const P = PRE_ENDINGS[kind];
  return {
    id: 'pre_' + kind, name: P.name, family: 'pre', scene: 'pre', res: 'pre',
    k: null, kHelp: KARDASHEV_HELP, voices: 'cut',
    lines: P.lines(S), epi: [], motif: null,
    witness: [
      { name: A(S).name, place: A(S).city, text: `那一年 ${S.y - A(S).born} 岁。${she(A(S))}不知道它的存在。` },
      { name: B(S).name, place: `${B(S).country}${B(S).city}`, text: `那一年 ${S.y - B(S).born} 岁。` },
    ],
    risk: [], reflect: [], words: wordsOf(S), wordsCoda: '这些话留在了一份问卷里。',
    last: '它没来得及醒来。',
    record: record(S, 'pre', P.name, '它没来得及醒来。'),
  };
}

export { region };
