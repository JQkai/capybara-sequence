import { describe, expect, it } from 'vitest';
import {
  LEVELS,
  MODES,
  createRng,
  generateQuestion,
  hintFor,
  isPlayable,
  isUnlocked,
  questionPoints,
  starsFor,
  type Level,
  type QuestionResult,
} from '../src';
import { question } from './helpers';

describe('hintFor', () => {
  it('第 1 層：只在兩個都看得到的相鄰數之間標差', () => {
    // 5、10、□、20、25：空格兩側不標，只標 5→10 和 20→25
    expect(hintFor(question([5, 10, 15, 20, 25], 2)).gaps).toEqual([
      { index: 0, label: '+5' },
      { index: 3, label: '+5' },
    ]);
  });

  it('往回數用減號', () => {
    expect(hintFor(question([30, 29, 28, 27, 26], 4)).gaps[0]).toEqual({ index: 0, label: '−1' });
  });

  it('第 2、3 層：說出規律、引導算出空格但不說答案', () => {
    const hint = hintFor(question([5, 10, 15, 20, 25], 3));
    expect(hint.rule).toBe('每次多 5');
    expect(hint.guide).toBe('15 再多 5 是多少？');
    expect(hintFor(question([40, 50, 60, 70, 80], 0)).guide).toBe('比 50 少 10 是多少？');
  });

  it('連續空格在開頭：引導先算旁邊有數的那一格', () => {
    const q = question([5, 10, 15, 20, 25, 30, 35], [0, 1]);
    expect(hintFor(q, 1).guide).toBe('比 15 少 5 是多少？');
    expect(hintFor(q, 0).guide).toBe('先算旁邊的空格：比 15 少 5 是多少？');
  });

  it('三種難度、每個空格的提示都不會洩漏答案，也一定有第 1 層可以標', () => {
    for (const level of LEVELS) {
      for (const mode of MODES) {
        for (let seed = 1; seed <= 200; seed++) {
          const q = generateQuestion(level, createRng(seed), { mode });
          // 引導句裡出現的數只能是看得到的數或差（答案剛好等於差的情況除外）
          const allowed = new Set([...q.terms.filter((_, i) => !q.blanks.includes(i)), Math.abs(q.step)]);
          for (const focus of q.blanks) {
            const hint = hintFor(q, focus);
            const numbers = (hint.guide.match(/\d+/g) ?? []).map(Number);
            for (const n of numbers) expect(allowed.has(n), `${hint.guide}（答案 ${q.answers}）`).toBe(true);
            expect(hint.gaps.length, q.key).toBeGreaterThan(0);
            for (const gap of hint.gaps) {
              expect(q.blanks).not.toContain(gap.index);
              expect(q.blanks).not.toContain(gap.index + 1);
            }
          }
        }
      }
    }
  });
});

describe('計分與星星', () => {
  const solo: QuestionResult = { correct: true, attempts: 1, hintsUsed: 0 };
  const helped: QuestionResult = { correct: true, attempts: 1, hintsUsed: 1 };
  const retry: QuestionResult = { correct: true, attempts: 2, hintsUsed: 0 };
  const wrong: QuestionResult = { correct: false, attempts: 2, hintsUsed: 3 };

  it('一題的分數', () => {
    expect(questionPoints(solo)).toBe(2);
    expect(questionPoints(helped)).toBe(1);
    expect(questionPoints(retry)).toBe(1);
    expect(questionPoints(wrong)).toBe(0);
  });

  it('星星：自己全對 3 顆，只有 1 題需要幫忙也是 3 顆', () => {
    expect(starsFor([solo, solo, solo, solo, solo])).toBe(3);
    expect(starsFor([solo, solo, solo, solo, helped])).toBe(3);
  });

  it('星星：越多題需要幫忙、答錯，星星越少', () => {
    expect(starsFor([solo, solo, solo, helped, helped])).toBe(2);
    expect(starsFor([solo, solo, wrong, wrong, wrong])).toBe(1);
    expect(starsFor([helped, helped, helped, wrong, wrong])).toBe(1);
    expect(starsFor([solo, wrong, wrong, wrong, wrong])).toBe(0);
    expect(starsFor([])).toBe(0);
  });

  it('全部都靠提示答對也能拿到星星，不會被扣光', () => {
    expect(starsFor([helped, helped, helped, helped, helped])).toBeGreaterThanOrEqual(1);
  });
});

describe('isUnlocked', () => {
  const term = (grade: 1 | 2, semester: 1 | 2) => LEVELS.filter((l) => l.grade === grade && l.semester === semester);

  it('每學期的第一關一定解鎖', () => {
    for (const [g, s] of [[1, 1], [1, 2], [2, 1], [2, 2]] as const) {
      expect(isUnlocked(term(g, s)[0]!, {})).toBe(true);
    }
  });

  it('前一關拿到 1 顆星以上才解鎖下一關', () => {
    const [first, second, third] = term(1, 1) as [Level, Level, Level];
    expect(isUnlocked(second, {})).toBe(false);
    expect(isUnlocked(second, { [first.id]: 0 })).toBe(false);
    expect(isUnlocked(second, { [first.id]: 1 })).toBe(true);
    expect(isUnlocked(third, { [first.id]: 3 })).toBe(false);
  });

  it('前一學期的進度不影響下一學期', () => {
    expect(isUnlocked(term(2, 1)[0]!, {})).toBe(true);
  });
});

describe('isPlayable：困難、天才版的解鎖', () => {
  const level = LEVELS[0]!;

  it('困難版要這關的簡單版拿到 2 顆星', () => {
    expect(isPlayable(level, 'hard', {})).toBe(false);
    expect(isPlayable(level, 'hard', { [level.id]: 1 })).toBe(false);
    expect(isPlayable(level, 'hard', { [level.id]: 2 })).toBe(true);
  });

  it('天才版要這關的困難版拿到 2 顆星，簡單版 3 顆星不算', () => {
    expect(isPlayable(level, 'genius', { [level.id]: 3 })).toBe(false);
    expect(isPlayable(level, 'genius', { [`${level.id}@hard`]: 2 })).toBe(true);
  });

  it('簡單版照地圖順序解鎖', () => {
    expect(isPlayable(LEVELS[1]!, 'easy', {})).toBe(false);
    expect(isPlayable(LEVELS[1]!, 'easy', { [level.id]: 1 })).toBe(true);
  });
});
