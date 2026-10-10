import { describe, expect, it } from 'vitest';
import {
  ALL_FAMILIES,
  FAMILY_GROUPS,
  FAMILY_RANK,
  FREE_PRESETS,
  FREE_TYPES,
  checkRule,
  createRng,
  customSettings,
  describeSpec,
  explain,
  freeUnique,
  generateFreeQuestion,
  hintFor,
  isUniquelyDetermined,
  predict,
  shownTerms,
  specFits,
  type FamilyId,
  type FreeSettings,
  type Question,
} from '../src';

const PRESETS = Object.entries(FREE_PRESETS).map(([id, p]) => [id, p.settings] as const);

function* samples(settings: FreeSettings, n = 400, types = settings.types) {
  for (let seed = 1; seed <= n; seed++) yield generateFreeQuestion(createRng(seed), { ...settings, types });
}

/** 驗算說明句：每一種句型都自己算一次 */
function reasonHolds(text: string): boolean {
  const t = text.replace(/（第 \d+ 個和第 \d+ 個一組）/, '');
  const rules: [RegExp, (m: number[]) => boolean][] = [
    [/^(\d+) 再多 (\d+) 是 (\d+)$/, ([a, d, b]) => a! + d! === b],
    [/^比 (\d+) 少 (\d+) 是 (\d+)$/, ([a, d, b]) => a! - d! === b],
    [/^(\d+) 乘 (\d+) 是 (\d+)$/, ([a, r, b]) => a! * r! === b],
    [/^(\d+) 除以 (\d+) 是 (\d+)$/, ([a, r, b]) => a! / r! === b],
    [/^(\d+) 的一半是 (\d+)$/, ([a, b]) => a! / 2 === b],
    [/^(\d+) 乘 (\d+) 再加 (\d+) 是 (\d+)$/, ([a, r, c, b]) => a! * r! + c! === b],
    [/^(\d+) 乘 (\d+) 再減 (\d+) 是 (\d+)$/, ([a, r, c, b]) => a! * r! - c! === b],
    [/^(\d+) 減 (\d+)，再除以 (\d+) 是 (\d+)$/, ([n, c, r, b]) => (n! - c!) / r! === b],
    [/^(\d+) 加 (\d+)，再除以 (\d+) 是 (\d+)$/, ([n, c, r, b]) => (n! + c!) / r! === b],
    [/^(\d+) 加 (\d+) 是 (\d+)$/, ([a, c, b]) => a! + c! === b],
    [/^(\d+) 減 (\d+) 是 (\d+)$/, ([a, c, b]) => a! - c! === b],
    [/^(\d+)×(\d+) 是 (\d+)$/, ([a, c, b]) => a! * c! === b],
  ];
  for (const [re, check] of rules) {
    const m = t.match(re);
    if (m) return check(m.slice(1).map(Number));
  }
  return false;
}

/**
 * 不用 predict()，自己暴力列舉三種簡單的規律，看看有沒有符合看得到的數、但空格答案不一樣的。
 * 用來驗證 predict() 推算正確。
 */
function bruteForceConflict(q: Question): FamilyId | null {
  const known = q.terms.map((t, i) => (q.blanks.includes(i) ? null : t));
  const [i0, v0] = known.map((v, i) => [i, v] as const).find(([, v]) => v !== null)! as [number, number];
  const rank = FAMILY_RANK[q.free!.spec.family];
  const conflicts = (seq: (k: number) => number) =>
    known.every((v, k) => v === null || v === seq(k)) && q.blanks.some((b) => seq(b) !== q.terms[b] && seq(b) >= 0);
  // 等差
  for (let d = -300; d <= 300; d++) if (conflicts((k) => v0 + (k - i0) * d)) return 'arith';
  if (rank < 2) return null;
  // 輪流加：位置 k 的數 = t0 + ceil(k/2)·a + floor(k/2)·b
  for (let a = -120; a <= 120; a++) {
    for (let b = -120; b <= 120; b++) {
      const t0 = v0 - Math.ceil(i0 / 2) * a - Math.floor(i0 / 2) * b;
      if (conflicts((k) => t0 + Math.ceil(k / 2) * a + Math.floor(k / 2) * b)) return 'alternate';
    }
  }
  // 差越來越大：位置 k 的數 = t0 + k·d0 + k(k−1)/2·g
  for (let d0 = -150; d0 <= 150; d0++) {
    for (let g = -30; g <= 30; g++) {
      const t0 = v0 - i0 * d0 - ((i0 * (i0 - 1)) / 2) * g;
      if (conflicts((k) => t0 + k * d0 + ((k * (k - 1)) / 2) * g)) return 'growing';
    }
  }
  return null;
}

describe('暴力檢查本身有效', () => {
  it('1、2、4、□ 每次乘 2：暴力檢查會抓到更簡單的規律（例如加 1、加 2 輪流得 5）', () => {
    const q = {
      key: 't', levelId: 'free', mode: 'free', type: 'fill', terms: [1, 2, 4, 8], blanks: [3], answers: [8],
      step: 1, choices: [], free: { spec: { family: 'multiply', params: [2] } },
    } as Question;
    expect(bruteForceConflict(q)).not.toBeNull();
    expect(bruteForceConflict({ ...q, terms: [1, 2, 4, 8, 16], blanks: [4], answers: [16] })).toBeNull();
  });
});

describe('predict：從看得到的數推算規律', () => {
  it('等差：兩個數就決定整串', () => {
    expect(predict('arith', [3, null, 11, null]).values).toEqual([3, 7, 11, 15]);
  });

  it('1、2、4、□：每次乘 2 和差越來越大都符合，答案不同，不能出', () => {
    expect(predict('multiply', [1, 2, 4, null]).values[3]).toBe(8);
    expect(predict('growing', [1, 2, 4, null]).values[3]).toBe(7);
    expect(freeUnique('multiply', [1, 2, 4, 8], [3])).toBe(false);
  });

  it('多看一個數就沒問題：1、2、4、8、□ 只有每次乘 2 符合', () => {
    expect(predict('growing', [1, 2, 4, 8, null]).fits).toBe(false);
    expect(freeUnique('multiply', [1, 2, 4, 8, 16], [4])).toBe(true);
  });

  it('前兩個數加起來：從 1、2 開始', () => {
    expect(predict('fibonacci', [1, 2, null, 5, null]).values).toEqual([1, 2, 3, 5, 8]);
  });

  it('看得到的數不夠時算不出唯一答案', () => {
    // 兩組交錯：單數位置只看得到一個數，算不出每次多多少
    expect(predict('interleave', [1, 50, 2, null, 3, null]).values[5]).toBeNull();
  });

  it('平方數也是差越來越大（差 3、5、7…），兩種說法答案一樣', () => {
    expect(freeUnique('square', [16, 25, 36, 49, 64, 81], [5])).toBe(true);
    expect(predict('growing', [16, 25, 36, 49, 64, null]).values[5]).toBe(81);
  });
});

describe.each(PRESETS)('自由模式「%s」出的題目', (_, settings) => {
  it('整串數符合規律、都在範圍內、答案唯一', () => {
    for (const q of samples(settings)) {
      const { spec } = q.free!;
      expect(settings.families).toContain(spec.family);
      expect(specFits(spec, q.terms), q.key).toBe(true);
      for (const t of [...q.terms, ...(q.wrong !== undefined ? [q.wrong] : []), ...q.choices]) {
        expect(Number.isInteger(t) && t >= 0 && t <= settings.max, q.key).toBe(true);
      }
      expect(q.terms.length).toBeGreaterThanOrEqual(settings.lengths[0]);
      expect(q.terms.length).toBeLessThanOrEqual(settings.lengths[1]);
      expect(isUniquelyDetermined(q), q.key).toBe(true);
    }
  });

  it('說明的順序：每一句只用到看得到的數或前面已經說明過的數', () => {
    for (const q of samples(settings, 300, ['fill'])) {
      const known = new Set(q.terms.filter((_, i) => !q.blanks.includes(i)));
      for (const [k, r] of explain(q).reasons.entries()) {
        // 句子最後的數是答案，前面用到的數都要已經知道（規律的參數、平方的底數不算）
        const numbers = (r.replace(/（第 \d+ 個和第 \d+ 個一組）/, '').match(/\d+/g) ?? []).map(Number);
        const answer = numbers.at(-1)!;
        const params = new Set([...q.free!.spec.params.map(Math.abs), ...q.terms.slice(1).map((t, i) => Math.abs(t - q.terms[i]!))]);
        for (const n of numbers.slice(0, -1)) {
          if (q.free!.spec.family === 'square' || params.has(n) || n <= 9) continue;
          expect(known.has(n), `第 ${k + 1} 句「${r}」用到還不知道的 ${n}（${q.key}）`).toBe(true);
        }
        known.add(answer);
      }
    }
  });

  it('說明句的計算都正確', () => {
    for (const q of samples(settings)) {
      const e = explain(q);
      expect(e.rule).toBe(describeSpec(q.free!.spec, q.terms));
      for (const r of e.reasons) expect(reasonHolds(r), `${r}（${q.key}）`).toBe(true);
    }
  });

  it('提示不會說出答案', () => {
    for (const q of samples(settings, 300, ['next', 'fill'])) {
      const visible = new Set(q.terms.filter((_, i) => !q.blanks.includes(i)));
      for (const b of q.blanks) {
        const numbers = (hintFor(q, b).guide.match(/\d+/g) ?? []).map(Number);
        // 提示裡可以出現的數：看得到的數、規律的參數、相鄰兩數的差、平方數的底數
        const allowed = new Set<number>([
          ...visible,
          ...q.free!.spec.params.map(Math.abs),
          ...q.terms.slice(1).map((t, i) => Math.abs(t - q.terms[i]!)),
          ...q.terms.map((t) => Math.sqrt(t)).filter(Number.isInteger),
        ]);
        for (const a of q.answers) {
          if (numbers.includes(a)) expect(allowed.has(a), `${hintFor(q, b).guide}（答案 ${a}，${q.key}）`).toBe(true);
        }
      }
    }
  });

  it('不用 predict 暴力檢查：比這題簡單的規律都算不出別的答案', () => {
    for (const q of samples(settings, 60, ['fill', 'next'])) {
      expect(bruteForceConflict(q), `${q.terms.join(',')} 空格 ${q.blanks}`).toBeNull();
    }
  });

  it('各題型的內容', () => {
    for (const type of settings.types) {
      for (const q of samples(settings, 150, [type])) {
        expect(q.type).toBe(type);
        if (type === 'next') {
          expect(q.choices).toHaveLength(4);
          expect(new Set(q.choices).size).toBe(4);
          expect(q.choices.filter((c) => c === q.answers[0])).toHaveLength(1);
        }
        if (type === 'fill') {
          expect(q.blanks.length).toBeGreaterThanOrEqual(settings.blanks[0]);
          expect(q.blanks.length).toBeLessThanOrEqual(settings.blanks[1]);
        }
        if (type === 'error') {
          const shown = shownTerms(q);
          expect(shown.filter((v, i) => v !== q.terms[i])).toEqual([q.wrong]);
        }
        if (type === 'order') {
          expect([...q.cards!].sort((a, b) => a - b)).toEqual([...q.terms].sort((a, b) => a - b));
          expect(q.cards).not.toEqual(q.terms);
        }
        if (type === 'rule') {
          const { ruleOptions, ruleAnswer } = q.free!;
          expect(ruleOptions).toHaveLength(4);
          expect(new Set(ruleOptions).size).toBe(4);
          expect(checkRule(q, ruleAnswer!)).toBe(true);
          expect(ruleOptions!.filter((o) => checkRule(q, o))).toHaveLength(1);
        }
      }
    }
  });
});

describe('說說規律的提示', () => {
  it('第 1 層只標實際的差，不標 ×2、一半（否則等於說出答案）；第 3 層拿錯誤選項算到對不上的地方', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const q = generateFreeQuestion(createRng(seed), { ...FREE_PRESETS.genius.settings, types: ['rule'] });
      const hint = hintFor(q);
      for (const g of hint.gaps) expect(g.label, q.key).toMatch(/^[+−]\d+$/);
      expect(hint.gaps.map((g) => g.label)).toEqual(
        q.terms.slice(1).map((t, i) => (t - q.terms[i]! >= 0 ? `+${t - q.terms[i]!}` : `−${q.terms[i]! - t}`)),
      );
      const m = hint.guide.match(/^試試「(.+)」：照它算，第 (\d+) 個應該是 (-?[\d.]+)，可是這裡是 (\d+)，所以不是它。$/);
      expect(m, hint.guide).toBeTruthy();
      const [, option, nth, expected, actual] = m!;
      // 拿來示範的一定是錯誤選項，而且「這裡是」說的數真的是那一顆
      expect(option).not.toBe(q.free!.ruleAnswer);
      expect(q.free!.ruleOptions).toContain(option);
      expect(Number(actual)).toBe(q.terms[Number(nth) - 1]);
      expect(Number(expected)).not.toBe(Number(actual));
    }
  });
});

describe('自由模式設定', () => {
  it('天才預設會出現所有規律', () => {
    const seen = new Set([...samples(FREE_PRESETS.genius.settings, 600)].map((q) => q.free!.spec.family));
    expect(seen).toEqual(new Set(ALL_FAMILIES));
  });

  it('五種題型都會出現', () => {
    const seen = new Set([...samples(FREE_PRESETS.brain.settings, 300)].map((q) => q.type));
    expect(seen).toEqual(new Set(FREE_TYPES));
  });

  it('自訂：只勾某一類規律，就只出那一類', () => {
    for (const group of Object.keys(FAMILY_GROUPS) as (keyof typeof FAMILY_GROUPS)[]) {
      const settings = customSettings({ groups: [group], max: 1000, blanks: 2, types: FREE_TYPES });
      for (const q of samples(settings, 100)) expect(FAMILY_GROUPS[group].families, q.key).toContain(q.free!.spec.family);
    }
  });

  it('自訂：100 以內、1 個空格', () => {
    const settings = customSettings({ groups: ['basic', 'growing'], max: 100, blanks: 1, types: ['fill'] });
    for (const q of samples(settings, 200)) {
      expect(Math.max(...q.terms)).toBeLessThanOrEqual(100);
      expect(q.blanks).toHaveLength(1);
    }
  });

  it('設定很嚴格也一定出得了題', () => {
    const settings = customSettings({ groups: ['multiply'], max: 100, blanks: 3, types: ['fill'] });
    for (let seed = 1; seed <= 50; seed++) expect(generateFreeQuestion(createRng(seed), settings)).toBeTruthy();
  });

  it('數字都在 1000 以內', () => {
    for (const [, settings] of PRESETS) expect(settings.max).toBeLessThanOrEqual(1000);
  });
});
