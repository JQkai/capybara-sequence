import { describe, expect, it } from 'vitest';
import {
  LEVELS,
  createRng,
  difficulty,
  explain,
  generateQuestion,
  generateRound,
  isUniquelyDetermined,
  levelRange,
  startCandidates,
  validateLevel,
  type Level,
} from '../src';

const SAMPLES = 1000;

function* samples(level: Level) {
  for (let seed = 1; seed <= SAMPLES; seed++) {
    yield generateQuestion(level, createRng(seed));
  }
}

describe('關卡設定', () => {
  it('關卡 id 不重複', () => {
    const ids = LEVELS.map((level) => level.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(LEVELS.map((level) => [level.id, level] as const))('%s 的每條規則都出得了題', (_, level) => {
    expect(() => validateLevel(level)).not.toThrow();
  });

  it('只有一、二年級', () => {
    for (const level of LEVELS) expect([1, 2]).toContain(level.grade);
  });

  it('數字不超過課綱範圍：一年級 100 以內、二年級 1000 以內', () => {
    for (const level of LEVELS) {
      const limit = level.grade === 1 ? 100 : 1000;
      for (const rule of level.rules) {
        expect(rule.min).toBeGreaterThanOrEqual(0);
        expect(rule.max).toBeLessThanOrEqual(limit);
      }
    }
  });
});

describe.each(LEVELS.map((level) => [level.id, level] as const))('%s 出的題目', (_, level) => {
  it('數列都在規則範圍內，且符合規則', () => {
    for (const q of samples(level)) {
      const rule = level.rules.find(
        (r) =>
          r.step === q.step &&
          q.terms.every((t) => t >= r.min && t <= r.max) &&
          (!r.startMultiple || q.terms[0]! % Math.abs(r.step) === 0),
      );
      expect(rule, `沒有規則能產生 ${q.terms.join(',')}`).toBeDefined();
      expect(q.terms).toHaveLength(level.length);
      q.terms.forEach((t, i) => {
        expect(Number.isInteger(t)).toBe(true);
        if (i > 0) expect(t - q.terms[i - 1]!).toBe(q.step);
      });
    }
  });

  it('答案唯一，而且等於空格位置的數', () => {
    for (const q of samples(level)) {
      expect(q.answer).toBe(q.terms[q.blankIndex]);
      expect(isUniquelyDetermined(q)).toBe(true);
    }
  });

  it('空格位置符合題型與關卡設定', () => {
    for (const q of samples(level)) {
      expect(level.types).toContain(q.type);
      if (q.type === 'next') expect(q.blankIndex).toBe(level.length - 1);
      if (!level.blankFirst) expect(q.blankIndex).toBeGreaterThan(0);
    }
  });

  it('選擇題的選項：數量正確、不重複、只有一個正確答案、不出現題目上看得到的數', () => {
    const { min, max } = levelRange(level);
    for (const q of samples(level)) {
      if (q.type !== 'next') {
        expect(q.choices).toEqual([]);
        continue;
      }
      const visible = q.terms.filter((_, i) => i !== q.blankIndex);
      expect(q.choices).toHaveLength(level.choiceCount);
      expect(new Set(q.choices).size).toBe(q.choices.length);
      expect(q.choices.filter((c) => c === q.answer)).toHaveLength(1);
      for (const c of q.choices) {
        expect(c).toBeGreaterThanOrEqual(min);
        expect(c).toBeLessThanOrEqual(max);
        if (c !== q.answer) expect(visible).not.toContain(c);
      }
    }
  });
});

describe('配合教材進度', () => {
  it('一下的 2 個、5 個、10 個一數在 50 以內（康軒一下先學 50 以內）', () => {
    for (const id of ['1b-by2', '1b-by5', '1b-by10']) {
      const level = LEVELS.find((l) => l.id === id)!;
      for (const q of samples(level)) expect(Math.max(...q.terms, ...q.choices)).toBeLessThanOrEqual(50);
    }
  });

  it('一上的倒著數在 10 以內', () => {
    const level = LEVELS.find((l) => l.id === '1a-back')!;
    for (const q of samples(level)) expect(Math.max(...q.terms, ...q.choices)).toBeLessThanOrEqual(10);
  });

  it('乘法關卡：數列裡每個數都是段次的 1～9 倍，說明裡有「倍」', () => {
    for (const level of LEVELS.filter((l) => l.id.startsWith('2a-times'))) {
      for (const q of samples(level)) {
        expect(q.timesOf).toBe(Math.abs(q.step));
        for (const t of q.terms) {
          expect(t % q.timesOf!).toBe(0);
          expect(t / q.timesOf!).toBeGreaterThanOrEqual(1);
          expect(t / q.timesOf!).toBeLessThanOrEqual(9);
        }
        expect(explain(q).times).toBe(`${q.timesOf} 的 ${q.answer / q.timesOf!} 倍是 ${q.answer}`);
      }
    }
  });

  it('非乘法關卡沒有「倍」的說明', () => {
    for (const level of LEVELS.filter((l) => !l.id.startsWith('2a-times'))) {
      for (const q of samples(level)) expect(explain(q).times).toBeUndefined();
    }
  });
});

describe('startCandidates', () => {
  it('倍數起點：5 個一數從 5 的倍數開始', () => {
    const starts = startCandidates({ step: 5, min: 5, max: 100, startMultiple: true }, 5);
    expect(starts[0]).toBe(5);
    expect(starts.at(-1)).toBe(80);
    expect(starts.every((s) => s % 5 === 0)).toBe(true);
  });

  it('往回數：起點要留夠空間往下數', () => {
    expect(startCandidates({ step: -1, min: 1, max: 10 }, 5)).toEqual([5, 6, 7, 8, 9, 10]);
  });

  it('跨過整百：數列一定跨過 100 的倍數', () => {
    const starts = startCandidates({ step: 1, min: 1, max: 1000, crossEvery: 100 }, 5);
    expect(starts).toContain(96);
    expect(starts).toContain(99);
    expect(starts).not.toContain(95);
    expect(starts).not.toContain(100);
  });

  it('step 為 0 時丟出錯誤', () => {
    expect(() => startCandidates({ step: 0, min: 1, max: 10 }, 5)).toThrow();
  });
});

describe('generateRound', () => {
  it('同一個種子產生相同的題目', () => {
    const level = LEVELS[0]!;
    expect(generateRound(level, createRng(42))).toEqual(generateRound(level, createRng(42)));
  });

  it('一回合由易到難：選擇題在前，補空格依空格位置（最後→中間→第一個）排在後', () => {
    for (const level of LEVELS) {
      for (let seed = 1; seed <= 200; seed++) {
        const levels = generateRound(level, createRng(seed)).map(difficulty);
        expect(levels).toEqual([...levels].sort((a, b) => a - b));
      }
    }
  });

  it('一回合 5 題，兩種題型都會出現，題目不重複', () => {
    for (const level of LEVELS) {
      for (let seed = 1; seed <= 200; seed++) {
        const round = generateRound(level, createRng(seed));
        expect(round).toHaveLength(5);
        expect(new Set(round.map((q) => q.type))).toEqual(new Set(['next', 'fill']));
        expect(new Set(round.map((q) => q.key)).size).toBe(5);
      }
    }
  });
});
