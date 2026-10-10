import { describe, expect, it } from 'vitest';
import {
  LEVELS,
  MODES,
  createRng,
  generateQuestion,
  hintFor,
  questionPoints,
  starsFor,
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
          const q = generateQuestion(level, createRng(seed), { mode, type: seed % 2 ? 'fill' : undefined });
          // 排一排的數字卡都看得到，找錯誤另外測試
          if (q.type === 'order' || q.type === 'error') continue;
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

describe('找錯誤、排一排的提示', () => {
  it('找錯誤：第 1 層每兩顆之間都標出實際的差，寫錯的數兩旁的差和規律不同', () => {
    // 2、4、6、9、10：9 應該是 8
    const q = question([2, 4, 6, 8, 10], 3, { type: 'error', wrong: 9 });
    const hint = hintFor(q);
    expect(hint.gaps.map((g) => g.label)).toEqual(['+2', '+2', '+3', '+1']);
    expect(hint.intro).toBe('看看石頭下面的數字，哪兩顆差得不一樣？');
    expect(hint.guide).toBe('2 和 4 差 2，每兩顆都應該差 2，哪一顆不是？');
  });

  it('找錯誤：所有題目的引導句只用沒寫錯的數，不會透露答案', () => {
    for (const level of LEVELS) {
      for (const mode of MODES) {
        for (let seed = 1; seed <= 200; seed++) {
          const q = generateQuestion(level, createRng(seed), { mode, type: 'error' });
          const hint = hintFor(q);
          expect(hint.gaps).toHaveLength(q.terms.length - 1);
          const correctShown = q.terms.filter((_, i) => i !== q.blanks[0]);
          const numbers = (hint.guide.match(/\d+/g) ?? []).map(Number);
          for (const n of numbers) {
            expect(correctShown.includes(n) || n === Math.abs(q.step), `${hint.guide}（${q.key}）`).toBe(true);
          }
        }
      }
    }
  });

  it('排一排：先找最小（往回數就找最大）的數', () => {
    const up = question([5, 10, 15, 20, 25], [0, 1, 2, 3, 4], { type: 'order', cards: [15, 5, 25, 10, 20] });
    expect(hintFor(up).intro).toBe('最小的數放第一顆，再從剩下的卡裡找最小的，一顆一顆排');
    expect(hintFor(up).guide).toBe('第一顆是 5，5 再多 5 是多少？');
    expect(hintFor(up).gaps).toEqual([]);
    const down = question([50, 40, 30, 20, 10], [0, 1, 2, 3, 4], { type: 'order', cards: [30, 10, 50, 20, 40] });
    expect(hintFor(down).intro).toBe('最大的數放第一顆，再從剩下的卡裡找最大的，一顆一顆排');
    expect(hintFor(down).guide).toBe('第一顆是 50，比 50 少 10 是多少？');
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
