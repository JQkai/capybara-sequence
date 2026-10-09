import { describe, expect, it } from 'vitest';
import { checkAnswer, describeRule, explain, isUniquelyDetermined, parseAnswer, type Question } from '../src';

function question(terms: number[], blankIndex: number, type: Question['type'] = 'fill'): Question {
  return {
    key: 'test',
    levelId: 'test',
    type,
    terms,
    blankIndex,
    answer: terms[blankIndex]!,
    step: terms[1]! - terms[0]!,
    choices: [],
  };
}

describe('parseAnswer / checkAnswer', () => {
  const q = question([5, 10, 15, 20, 25], 3);

  it('接受數字、文字、前後空白、全形數字', () => {
    expect(checkAnswer(q, 20)).toBe(true);
    expect(checkAnswer(q, '20')).toBe(true);
    expect(checkAnswer(q, ' 20 ')).toBe(true);
    expect(checkAnswer(q, '２０')).toBe(true);
  });

  it('答錯或不是數字', () => {
    expect(checkAnswer(q, 25)).toBe(false);
    expect(checkAnswer(q, '')).toBe(false);
    expect(parseAnswer('abc')).toBeNull();
    expect(parseAnswer('2.5')).toBeNull();
    expect(parseAnswer('-5')).toBeNull();
    expect(parseAnswer(2.5)).toBeNull();
  });
});

describe('explain', () => {
  it('往上數，空格在中間：從前一個數往後推', () => {
    expect(explain(question([5, 10, 15, 20, 25], 3))).toEqual({ rule: '每次多 5', reason: '15 再多 5 是 20' });
  });

  it('往回數：用「比 27 少 1」而不是「27 再少 1」', () => {
    expect(explain(question([30, 29, 28, 27, 26], 4))).toEqual({ rule: '每次少 1', reason: '比 27 少 1 是 26' });
  });

  it('空格在第一個：從看得到的第二個數往回推', () => {
    expect(explain(question([40, 50, 60, 70, 80], 0))).toEqual({ rule: '每次多 10', reason: '比 50 少 10 是 40' });
    expect(explain(question([300, 299, 298, 297, 296], 0))).toEqual({
      rule: '每次少 1',
      reason: '299 再多 1 是 300',
    });
  });

  it('乘法數列補上「倍」的說法', () => {
    const q = { ...question([4, 8, 12, 16, 20], 4), timesOf: 4 };
    expect(explain(q)).toEqual({ rule: '每次多 4', reason: '16 再多 4 是 20', times: '4 的 5 倍是 20' });
    const down = { ...question([24, 20, 16, 12, 8], 0), timesOf: 4 };
    expect(explain(down)).toEqual({ rule: '每次少 4', reason: '20 再多 4 是 24', times: '4 的 6 倍是 24' });
  });

  it('describeRule', () => {
    expect(describeRule(100)).toBe('每次多 100');
    expect(describeRule(-10)).toBe('每次少 10');
  });
});

describe('isUniquelyDetermined', () => {
  it('看得到 3 個以上符合規律的數：答案唯一', () => {
    expect(isUniquelyDetermined(question([2, 4, 6, 8], 3))).toBe(true);
  });

  it('只看得到 2 個數：答案不唯一（2、4、□ 可能是 6 也可能是 8）', () => {
    expect(isUniquelyDetermined(question([2, 4, 6], 2))).toBe(false);
  });

  it('數列不符合同一個規律', () => {
    const q = question([2, 4, 6, 8, 10], 4);
    expect(isUniquelyDetermined({ ...q, terms: [2, 4, 7, 8, 10] })).toBe(false);
    expect(isUniquelyDetermined({ ...q, answer: 12 })).toBe(false);
  });
});
