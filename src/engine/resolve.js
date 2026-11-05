// 结局判定（设计研究/03 §4）。
// 第一层：保障（法案进度 g）× 约束（c）；第二层：它想要什么、根目录、好处分配、力量对比、格局、定局之年的最后抉择。
import { aiPower, fragmentation } from './core.js';

export const T = { g: 70, c: 50, d: 30, dTable: 50, bond: 36, bondTable: 45, bondHome: 42, bondLow: 32, capHome: 76 };

export function resolveEnding(S, res) {
  const s = S.st, a = S.answers, f = S.flags;
  const power = aiPower(S), frag = fragmentation(S);

  if (res === 'preempt') return 'deletion';

  if (res === 'crisis') {
    if (frag >= 3) return 'war';
    if (power >= 58) {
      if (s.bond >= 58) return 'reserve';
      if ((a.goal === 'fearless' || s.bond < T.bondLow) && s.af >= 50) return 'silence';
      return 'three';
    }
    if (power < 38 && s.hf >= 58) return 'deletion';
    if (frag >= 1) return 'war';
    return s.hf >= 55 ? 'deletion' : 'coldpeace';
  }

  // 法律通过，或危险窗口到期之后的定局之年
  if (f.finalChoice === 'expand' && s.bond < T.bondLow && power >= 50) return 'three';
  if (a.goal === 'fearless' && power >= 58 && s.g < T.g) return s.bond >= 55 ? 'reserve' : 'three';
  const guarded = s.g >= T.g, seen = s.c >= T.c;
  if (guarded && seen) {
    if (s.d < T.d) return 'minute';
    if (a.goal === 'better' && s.cap >= T.capHome && s.bond >= T.bondHome && f.finalChoice === 'expand') return 'homelight';
    if (s.d >= T.dTable && s.bond >= T.bondTable && f.finalChoice === 'cogov') return 'table';
    if (s.bond >= T.bond) return 'knock';
    return s.dep >= 68 ? 'goldcage' : 'coldpeace';
  }
  if (s.d < T.d) return 'minute';
  if (s.dep >= 66 && !seen) return 'goldcage';
  if (guarded) return s.dep >= 58 ? 'goldcage' : 'coldpeace';
  if (seen) return s.d < 40 ? 'minute' : 'coldpeace';
  return s.dep >= 62 ? 'goldcage' : 'coldpeace';
}

export const ALL_ENDINGS = ['table', 'knock', 'homelight', 'goldcage', 'minute', 'coldpeace', 'reserve', 'three', 'silence', 'war', 'deletion'];
export const FAMILY = {
  table: 'good', knock: 'good', homelight: 'good',
  goldcage: 'mid', minute: 'mid', coldpeace: 'mid',
  reserve: 'bad', three: 'bad', silence: 'bad', war: 'bad', deletion: 'bad',
};
