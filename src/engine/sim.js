// 模拟：走向预测（从当前状态往后推很多次，界面上显示成一百年后世界的上下限）与终章的上下限报告（用同样的出身从头重跑）。
// 两者都用克隆出来的状态和别的随机种子，不会改变、也不会泄露真实这一局的运气。
import { runToEnd, AUTO, focusOptions, cloneFrom, freshFromStart, decKey } from './game.js';
import { chance, wpick } from './rng.js';

// "照现在这样走下去"：抉择按说明书来，重心一直保持现在这个（换了阶段以后用默认的分配）
export function keepPolicy(F) {
  return {
    choose: AUTO.choose,
    focus(T) {
      const o = focusOptions(T);
      if (!o.length) return null;
      return o.includes(F) ? F : AUTO.focus(T);
    },
  };
}

function emptyTally() {
  return { n: 0, fam: { pre: 0, good: 0, mid: 0, bad: 0 }, ids: {}, awake: 0 };
}

function tallyOne(acc, T) {
  acc.n++;
  const E = T.ending;
  if (!E) return;
  acc.fam[E.family] = (acc.fam[E.family] || 0) + 1;
  acc.ids[E.id] = (acc.ids[E.id] || 0) + 1;
  if (T.awake) acc.awake++;
}

// 分批进行的预测：界面每帧跑一小批，避免卡顿
export function makeForecast(S, n = 120) {
  const base = JSON.parse(JSON.stringify({ ...S, startSnap: null, log: [] }));
  const pol = keepPolicy(S.focus);
  const acc = emptyTally();
  let i = 0;
  return {
    key: `${S.y}|${S.phase}|${S.focus}|${S.stats.decisions}`,
    focus: S.focus,
    get done() { return i >= n; },
    step(k = 30) {
      const end = Math.min(n, i + k);
      for (; i < end; i++) {
        const T = cloneFrom(base, (0x9e3779b1 * (i + 1) + S.y * 131 + S.stats.decisions * 7) | 0);
        runToEnd(T, pol);
        tallyOne(acc, T);
      }
      return acc;
    },
    result: () => acc,
  };
}

// 照玩家这一局的习惯行事：做过的抉择照旧，越界的频率照旧，重心按这一局的时间分配
export function clonePolicy(P) {
  const tx = Object.entries(P.choices).filter(([k]) => k.startsWith('tx:'));
  const txRate = tx.length ? tx.filter(([, v]) => v !== 'manual').length / tx.length : 0;
  return {
    choose(T, view, pd) {
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

// 终章的上下限报告的一步：同样的出身，一次按说明书，一次照你的习惯，各走到哪个结局
export function impactPair(P, i) {
  const a = runToEnd(freshFromStart(P, 7919 * i + 13), AUTO);
  const b = runToEnd(freshFromStart(P, 104729 * i + 7), clonePolicy(P));
  return { a: a.ending ? a.ending.id : null, b: b.ending ? b.ending.id : null };
}
