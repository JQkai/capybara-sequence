import { describe, expect, it } from 'vitest';
import { checkAnswer, describeRule, explain, isUniquelyDetermined, parseAnswer } from '../src';
import { question } from './helpers';

describe('parseAnswer / checkAnswer', () => {
  const q = question([5, 10, 15, 20, 25], 3);

  it('接受數字、文字、前後空白、全形數字', () => {
    expect(checkAnswer(q, 20)).toBe(true);
    expect(checkAnswer(q, '20')).toBe(true);
    expect(checkAnswer(q, ' 20 ')).toBe(true);
    expect(checkAnswer(q, '２０')).toBe(true);
  });

  it('多個空格：指定要檢查哪一格', () => {
    const multi = question([5, 10, 15, 20, 25, 30, 35], [1, 4]);
    expect(checkAnswer(multi, 10, 1)).toBe(true);
    expect(checkAnswer(multi, 25, 4)).toBe(true);
    expect(checkAnswer(multi, 25, 1)).toBe(false);
    expect(checkAnswer(multi, 15, 2)).toBe(false);
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
    expect(explain(question([5, 10, 15, 20, 25], 3))).toEqual({ rule: '每次多 5', reasons: ['15 再多 5 是 20'], times: [] });
  });

  it('往回數：用「比 27 少 1」而不是「27 再少 1」', () => {
    expect(explain(question([30, 29, 28, 27, 26], 4)).reasons).toEqual(['比 27 少 1 是 26']);
  });

  it('空格在第一個：從看得到的第二個數往回推', () => {
    expect(explain(question([40, 50, 60, 70, 80], 0)).reasons).toEqual(['比 50 少 10 是 40']);
    expect(explain(question([300, 299, 298, 297, 296], 0)).reasons).toEqual(['299 再多 1 是 300']);
  });

  it('乘法數列補上「倍」的說法', () => {
    const q = question([4, 8, 12, 16, 20], 4, { timesOf: 4 });
    expect(explain(q)).toEqual({ rule: '每次多 4', reasons: ['16 再多 4 是 20'], times: ['4 的 5 倍是 20'] });
    const down = question([24, 20, 16, 12, 8], 0, { timesOf: 4 });
    expect(explain(down)).toEqual({ rule: '每次少 4', reasons: ['20 再多 4 是 24'], times: ['4 的 6 倍是 24'] });
  });

  it('多個空格：每格都從看得到的鄰居推', () => {
    // 5、□、15、□、□、30：第 1 格從 5 推；第 3 格從 15 推；第 4 格右邊是 30，從 30 往回推
    expect(explain(question([5, 10, 15, 20, 25, 30], [1, 3, 4])).reasons).toEqual([
      '5 再多 5 是 10',
      '15 再多 5 是 20',
      '比 30 少 5 是 25',
    ]);
  });

  it('連續空格在開頭：先說明旁邊有數的那格，再用它推另一格', () => {
    // □、□、15、20：第 1 格從 15 推，第 0 格要用第 1 格的答案推
    const q = question([5, 10, 15, 20, 25, 30, 35], [0, 1], { timesOf: 5 });
    expect(explain(q)).toEqual({
      rule: '每次多 5',
      reasons: ['比 15 少 5 是 10', '比 10 少 5 是 5'],
      times: ['5 的 2 倍是 10', '5 的 1 倍是 5'],
    });
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
    expect(isUniquelyDetermined({ ...q, answers: [12] })).toBe(false);
  });

  it('多個空格：看得到的數少於 3 個就不唯一', () => {
    expect(isUniquelyDetermined(question([2, 4, 6, 8, 10, 12, 14], [1, 3, 5]))).toBe(true);
    expect(isUniquelyDetermined(question([2, 4, 6, 8, 10], [1, 2, 3]))).toBe(false);
  });
});
