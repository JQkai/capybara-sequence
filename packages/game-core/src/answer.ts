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
 */
export function isUniquelyDetermined(question: Question): boolean {
  const { terms, blanks, answers, step } = question;
  if (step === 0 || blanks.length !== answers.length) return false;
  const known = terms.map((value, index) => ({ value, index })).filter((t) => !blanks.includes(t.index));
  if (known.length < 3) return false;
  const first = known[0]!;
  const at = (index: number) => first.value + (index - first.index) * step;
  return known.every((t) => t.value === at(t.index)) && blanks.every((b, k) => answers[k] === at(b));
}
