import { describe, expect, it } from 'vitest';
import {
  LEVELS,
  MODES,
  createRng,
  describeGenius,
  explain,
  geniusTwists,
  generateQuestion,
  generateRound,
  isUniquelyDetermined,
  levelRange,
  questionRank,
  settingsFor,
  startCandidates,
  validBlanks,
  validateLevel,
  type Level,
  type Mode,
  type Question,
  type StepRule,
} from '../src';

const SAMPLES = 1000;

function* samples(level: Level, mode: Mode = 'easy') {
  for (let seed = 1; seed <= SAMPLES; seed++) {
    yield generateQuestion(level, createRng(seed), { mode });
  }
}

/** 這個數列是不是由這條規則產生的 */
function fits(rule: StepRule, q: Question): boolean {
  const first = q.terms[0]!;
  const last = q.terms.at(-1)!;
  const size = Math.abs(rule.step);
  return (
    rule.step === q.step &&
    q.terms.every((t) => t >= rule.min && t <= rule.max) &&
    (!rule.startMultiple || first % size === 0) &&
    (!rule.offStart || first % size !== 0) &&
    (!rule.crossEvery ||
      Math.floor(Math.min(first, last) / rule.crossEvery) !== Math.floor(Math.max(first, last) / rule.crossEvery))
  );
}

const levelCases = LEVELS.map((level) => [level.id, level] as const);
const modeCases = LEVELS.flatMap((level) => MODES.map((mode) => [`${level.id} ${mode}`, level, mode] as const));

describe('關卡設定', () => {
  it('關卡 id 不重複', () => {
    const ids = LEVELS.map((level) => level.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(levelCases)('%s 三種難度的每條規則都出得了題', (_, level) => {
    expect(() => validateLevel(level)).not.toThrow();
  });

  it('只有一、二年級', () => {
    for (const level of LEVELS) expect([1, 2]).toContain(level.grade);
  });

  it('三種難度的數字都不超過課綱範圍：一年級 100 以內、二年級 1000 以內', () => {
    for (const level of LEVELS) {
      const limit = level.grade === 1 ? 100 : 1000;
      for (const mode of MODES) {
        for (const rule of settingsFor(level, mode).rules) {
          expect(rule.min).toBeGreaterThanOrEqual(0);
          expect(rule.max).toBeLessThanOrEqual(limit);
        }
      }
    }
  });
});

describe.each(modeCases)('%s 出的題目', (_, level, mode) => {
  const settings = settingsFor(level, mode);

  it('數列都在規則範圍內，且符合規則', () => {
    for (const q of samples(level, mode)) {
      expect(q.mode).toBe(mode);
      expect(settings.rules.some((r) => fits(r, q)), `沒有規則能產生 ${q.terms.join(',')}`).toBe(true);
      expect(q.terms).toHaveLength(settings.length);
      q.terms.forEach((t, i) => {
        expect(Number.isInteger(t)).toBe(true);
        if (i > 0) expect(t - q.terms[i - 1]!).toBe(q.step);
      });
    }
  });

  it('答案唯一，而且等於空格位置的數', () => {
    for (const q of samples(level, mode)) {
      expect(q.answers).toEqual(q.blanks.map((b) => q.terms[b]));
      expect(isUniquelyDetermined(q)).toBe(true);
    }
  });

  it('空格位置符合難度與關卡設定', () => {
    for (const q of samples(level, mode)) {
      expect(settings.types).toContain(q.type);
      expect([...q.blanks].sort((a, b) => a - b)).toEqual(q.blanks);
      if (mode === 'easy') {
        expect(q.blanks).toHaveLength(1);
        if (q.type === 'next') expect(q.blanks[0]).toBe(settings.length - 1);
        if (!level.blankFirst) expect(q.blanks[0]).toBeGreaterThan(0);
      } else {
        expect(q.type).toBe('fill');
        expect(q.blanks.length).toBeGreaterThanOrEqual(mode === 'hard' ? 2 : 3);
        expect(q.blanks.length).toBeLessThanOrEqual(3);
        expect(validBlanks(q.blanks, q.terms.length)).toBe(true);
      }
    }
  });

  it('選擇題的選項：數量正確、不重複、只有一個正確答案、不出現題目上看得到的數', () => {
    const { min, max } = levelRange(level, mode);
    for (const q of samples(level, mode)) {
      if (q.type !== 'next') {
        expect(q.choices).toEqual([]);
        continue;
      }
      const answer = q.answers[0]!;
      const visible = q.terms.filter((_, i) => !q.blanks.includes(i));
      expect(q.choices).toHaveLength(level.choiceCount);
      expect(new Set(q.choices).size).toBe(q.choices.length);
      expect(q.choices.filter((c) => c === answer)).toHaveLength(1);
      for (const c of q.choices) {
        expect(c).toBeGreaterThanOrEqual(min);
        expect(c).toBeLessThanOrEqual(max);
        if (c !== answer) expect(visible).not.toContain(c);
      }
    }
  });
});

describe('困難版', () => {
  it('7～8 個數；沒有特別指定長度、又排得下 8 個的關卡用 8 個', () => {
    for (const level of LEVELS) {
      const { length, rules } = settingsFor(level, 'hard');
      expect([7, 8]).toContain(length);
      if (!level.hard?.length && rules.every((r) => startCandidates(r, 8).length > 0)) expect(length).toBe(8);
    }
  });

  it.each(MODES.filter((m) => m !== 'easy'))('%s：每關至少 5 種數列，一回合不會一直出現同一串數', (mode) => {
    for (const level of LEVELS) {
      const { rules, length } = settingsFor(level, mode);
      const sequences = new Set<string>();
      for (const r of rules) {
        for (const s of startCandidates(r, length)) sequences.add(`${s}/${r.step}`);
      }
      expect(sequences.size, level.id).toBeGreaterThanOrEqual(5);
      const counts = new Map<string, number>();
      for (const q of samples(level, mode)) counts.set(q.terms.join(','), (counts.get(q.terms.join(',')) ?? 0) + 1);
      expect(Math.max(...counts.values()) / SAMPLES, level.id).toBeLessThan(0.35);
    }
  });

  it('數到 10、倒著數的困難版 7 個數、可以有 0', () => {
    for (const id of ['1a-to10', '1a-back']) {
      const level = LEVELS.find((l) => l.id === id)!;
      expect(settingsFor(level, 'hard').length).toBe(7);
      expect([...samples(level, 'hard')].some((q) => q.terms.includes(0)), id).toBe(true);
    }
  });

  it('會出現連續兩個空格、空格在開頭，兩個和三個空格都有', () => {
    for (const level of LEVELS) {
      const qs = [...samples(level, 'hard')];
      expect(qs.some((q) => q.blanks.some((b) => q.blanks.includes(b + 1))), level.id).toBe(true);
      expect(qs.some((q) => q.blanks[0] === 0), level.id).toBe(true);
      expect(qs.some((q) => q.blanks.length === 2), level.id).toBe(true);
      expect(qs.some((q) => q.blanks.length === 3), level.id).toBe(true);
    }
  });

  it('validBlanks：不能連續三格、至少一對相鄰的數看得到、看得到的數至少 3 個', () => {
    expect(validBlanks([0, 1], 8)).toBe(true);
    expect(validBlanks([2, 3, 5], 8)).toBe(true);
    expect(validBlanks([2, 3, 4], 8)).toBe(false);
    expect(validBlanks([1, 4, 6], 8)).toBe(true);
    // 看得到 0、2、4、6，但沒有任何兩個相鄰，看不出每次差多少
    expect(validBlanks([1, 3, 5], 7)).toBe(false);
    expect(validBlanks([0, 2, 4], 5)).toBe(false);
  });

  it('5 個、10 個一數困難版放寬到 100 以內，簡單版仍在 50 以內', () => {
    for (const id of ['1b-by5', '1b-by10']) {
      const level = LEVELS.find((l) => l.id === id)!;
      expect(levelRange(level, 'easy').max).toBe(50);
      expect(levelRange(level, 'hard').max).toBe(100);
    }
  });

  it('乘法關卡困難版會往回數', () => {
    for (const level of LEVELS.filter((l) => l.id.startsWith('2a-times'))) {
      const qs = [...samples(level, 'hard')];
      expect(qs.some((q) => q.step < 0), level.id).toBe(true);
      expect(qs.some((q) => q.step > 0), level.id).toBe(true);
    }
  });
});

describe('天才版', () => {
  it('一律 3 個空格', () => {
    for (const level of LEVELS) {
      for (const q of samples(level, 'genius')) expect(q.blanks, level.id).toHaveLength(3);
    }
  });

  const level = (id: string) => LEVELS.find((l) => l.id === id)!;

  it('原本的規則也留著一起混合出題', () => {
    for (const l of LEVELS) {
      const genius = settingsFor(l, 'genius').rules;
      for (const h of settingsFor(l, 'hard').rules) expect(genius, l.id).toContainEqual(h);
    }
  });

  it('不從倍數開始：一年級只有百數表挑戰，二年級的 2、5、100 個一數會出現，乘法關卡不會', () => {
    expect(LEVELS.filter((l) => l.grade === 1 && geniusTwists(l).offStart).map((l) => l.id)).toEqual(['1b-chart']);
    for (const id of ['1b-by2', '1b-by5']) {
      for (const q of samples(level(id), 'genius')) expect(q.terms[0]! % Math.abs(q.step), id).toBe(0);
    }
    expect([...samples(level('1b-chart'), 'genius')].some((q) => q.terms[0]! % 5 !== 0 && Math.abs(q.step) === 5)).toBe(true);
    expect(geniusTwists(level('2b-mix')).offStart).toBe(true);
    for (const l of LEVELS.filter((l) => l.id.startsWith('2a-times'))) {
      expect(geniusTwists(l).offStart, l.id).toBe(false);
      for (const q of samples(l, 'genius')) expect(q.terms[0]! % Math.abs(q.step)).toBe(0);
    }
  });

  it('範圍裡沒有整十可以跨的關卡，不加「跨過」', () => {
    for (const id of ['1a-to10', '1a-back']) {
      expect(geniusTwists(level(id)), id).toEqual({ offStart: false, crossTens: false, crossHundreds: false, descending: false });
      for (const rule of settingsFor(level(id), 'genius').rules) expect(rule.crossEvery, id).toBeUndefined();
    }
    expect(geniusTwists(level('1a-to30')).crossTens).toBe(true);
  });

  it('往回數只加在二年級', () => {
    for (const level of LEVELS.filter((l) => l.grade === 1)) {
      const easySteps = new Set(level.rules.map((r) => r.step));
      for (const rule of settingsFor(level, 'genius').rules) expect(easySteps.has(rule.step), level.id).toBe(true);
    }
    const mix = [...samples(LEVELS.find((l) => l.id === '2b-by100')!, 'genius')];
    expect(mix.some((q) => q.step < 0)).toBe(true);
  });

  it('說明文字依實際有的變化產生', () => {
    const term = (g: number, s: number) => LEVELS.filter((l) => l.grade === g && l.semester === s);
    expect(describeGenius(term(1, 1))).toBe('一律 3 個空格，有些題目還會跨過整十');
    expect(describeGenius(term(1, 2))).toBe('一律 3 個空格，有些題目還會不從倍數開始、跨過整十');
    expect(describeGenius(term(2, 2))).toContain('往回數');
    expect(describeGenius(term(2, 2))).toContain('不從倍數開始');
    expect(describeGenius([level('1a-to10')])).toBe('一律 3 個空格');
    for (const g of [1, 2]) {
      for (const s of [1, 2]) {
        if (g === 1) expect(describeGenius(term(g, s))).not.toMatch(/整百|往回數/);
      }
    }
  });

  it('會出現跨過整十、整百的數列', () => {
    const to200 = [...samples(LEVELS.find((l) => l.id === '2a-to200')!, 'genius')];
    const crosses = (q: Question, every: number) =>
      Math.floor(Math.min(q.terms[0]!, q.terms.at(-1)!) / every) !==
      Math.floor(Math.max(q.terms[0]!, q.terms.at(-1)!) / every);
    expect(to200.some((q) => Math.abs(q.step) === 10 && crosses(q, 100))).toBe(true);
  });
});

describe('配合教材進度（簡單版）', () => {
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
});

describe('乘法說明', () => {
  it.each(MODES)('%s：數列裡每個數都是段次的 1～9 倍，每個空格都有「倍」的說明', (mode) => {
    for (const level of LEVELS.filter((l) => l.id.startsWith('2a-times'))) {
      for (const q of samples(level, mode)) {
        expect(q.timesOf).toBe(Math.abs(q.step));
        for (const t of q.terms) {
          expect(t % q.timesOf!).toBe(0);
          expect(t / q.timesOf!).toBeGreaterThanOrEqual(1);
          expect(t / q.timesOf!).toBeLessThanOrEqual(9);
        }
        const expected = q.answers.map((a) => `${q.timesOf} 的 ${a / q.timesOf!} 倍是 ${a}`);
        expect([...explain(q).times].sort()).toEqual(expected.sort());
      }
    }
  });

  it('非乘法關卡沒有「倍」的說明', () => {
    for (const level of LEVELS.filter((l) => !l.id.startsWith('2a-times'))) {
      for (const mode of MODES) {
        for (const q of samples(level, mode)) expect(explain(q).times).toEqual([]);
      }
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

  it('不從倍數開始', () => {
    const starts = startCandidates({ step: 5, min: 1, max: 50, offStart: true }, 5);
    expect(starts).toContain(3);
    expect(starts.some((s) => s % 5 === 0)).toBe(false);
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

  it.each(MODES)('%s：一回合由易到難', (mode) => {
    for (const level of LEVELS) {
      for (let seed = 1; seed <= 100; seed++) {
        const ranks = generateRound(level, createRng(seed), { mode }).map(questionRank);
        expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
      }
    }
  });

  it.each(MODES)('%s：一回合 5 題，題目不重複', (mode) => {
    for (const level of LEVELS) {
      for (let seed = 1; seed <= 100; seed++) {
        const round = generateRound(level, createRng(seed), { mode });
        expect(round).toHaveLength(5);
        expect(new Set(round.map((q) => q.key)).size).toBe(5);
        if (mode === 'easy') expect(new Set(round.map((q) => q.type))).toEqual(new Set(['next', 'fill']));
      }
    }
  });
});
