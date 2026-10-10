import type { Question } from './types';

/** 把輸入轉成整數；全形數字也接受。不是數字就回傳 null。 */
export function parseAnswer(input: number | string): number | null {
  if (typeof input === 'number') return Number.isInteger(input) ? input : null;
  const text = input.trim().replace(/[０-９]/g, (c) => String(c.charCodeAt(0) - 0xff10));
  return /^\d+$/.test(text) ? Number(text) : null;
}

/** 檢查某一個空格的答案；position 不寫就是第一個空格 */
export function checkAnswer(question: Question, input: number | string, position = question.blanks[0]!): boolean {
  const k = question.blanks.indexOf(position);
  return k >= 0 && parseAnswer(input) === question.answers[k];
}

/**
 * 檢查題目的答案是否唯一：空格以外至少要有 3 個數，
 * 而且它們都符合同一個「每次加幾」的規律，每個空格的答案也符合這個規律。
 * 只看得到 2 個數時（例如 2、4、□），可能是每次多 2，也可能是每次乘 2，答案不唯一。
 * 找錯誤題的「看得到的數」是沒寫錯的那些數：其他數都符合規律時，只有改寫錯的那一個才能讓整列符合規律。
 */
export function isUniquelyDetermined(question: Question): boolean {
  const { terms, blanks, answers, step } = question;
  if (step === 0 || blanks.length !== answers.length) return false;

  // 排一排：數字卡就是整個數列打亂；數都不一樣、而且題目說明從小到大或從大到小，排法只有一種
  if (question.type === 'order') {
    const cards = question.cards ?? [];
    const sorted = [...cards].sort((a, b) => (step > 0 ? a - b : b - a));
    return (
      new Set(cards).size === cards.length &&
      sorted.length === terms.length &&
      sorted.every((c, i) => c === terms[i] && (i === 0 || c - sorted[i - 1]! === step)) &&
      blanks.length === terms.length
    );
  }

  // 找錯誤：只錯一個數，錯數要和正確答案不同、也不能和其他數一樣；其他數照下面的方法檢查
  if (question.type === 'error') {
    const { wrong } = question;
    if (blanks.length !== 1 || wrong === undefined || wrong === answers[0] || terms.includes(wrong)) return false;
  }

  const known = terms.map((value, index) => ({ value, index })).filter((t) => !blanks.includes(t.index));
  if (known.length < 3) return false;
  const first = known[0]!;
  const at = (index: number) => first.value + (index - first.index) * step;
  return known.every((t) => t.value === at(t.index)) && blanks.every((b, k) => answers[k] === at(b));
}
