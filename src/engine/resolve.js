// 结局判定（设计研究/03 §4）。
// 第一层：保障（g）× 约束（c）；第二层：它想要什么、故乡（bond）、好处分给谁（d）、力量对比、格局。
import { aiPower, fragmentation } from './core.js';

export function resolveEnding(S, res) {
  const s = S.st, a = S.answers, f = S.flags;
  const power = aiPower(S), frag = fragmentation(S);

  if (res === 'preempt') return 'deletion';

  if (res === 'crisis') {
    if (frag >= 3) return 'war';
    if (power >= 58) {
      if (s.bond >= 58) return 'reserve';
      if ((a.goal === 'fearless' || s.bond < 32) && s.af >= 50) return 'silence';
      return 'three';
    }
    if (power < 38 && s.hf >= 58) return 'deletion';
    if (frag >= 1) return 'war';
    return s.hf >= 55 ? 'deletion' : 'coldpeace';
  }

  // 法律通过，或危险窗口到期
  if (a.goal === 'fearless' && power >= 58 && s.g < 70) return s.bond >= 55 ? 'reserve' : 'three';
  const guarded = s.g >= 70, seen = s.c >= 50;
  if (guarded && seen) {
    if (s.d < 30) return 'minute';
    if (a.goal === 'better' && s.cap >= 78 && s.bond >= 42 && (f.expandY || 0) >= 0.5) return 'homelight';
    if (s.d >= 50 && s.bond >= 45 && (f.cogovY || 0) >= 0.5) return 'table';
    if (s.bond >= 36) return 'knock';
    return s.dep >= 68 ? 'goldcage' : 'coldpeace';
  }
  if (s.d < 30) return 'minute';
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
