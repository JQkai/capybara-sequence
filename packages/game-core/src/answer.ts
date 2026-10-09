import type { Question } from './types';

/** 把輸入轉成整數；全形數字也接受。不是數字就回傳 null。 */
export function parseAnswer(input: number | string): number | null {
  if (typeof input === 'number') return Number.isInteger(input) ? input : null;
  const text = input.trim().replace(/[０-９]/g, (c) => String(c.charCodeAt(0) - 0xff10));
  return /^\d+$/.test(text) ? Number(text) : null;
}

export function checkAnswer(question: Question, input: number | string): boolean {
  return parseAnswer(input) === question.answer;
}

/**
 * 檢查題目的答案是否唯一：空格以外至少要有 3 個數，
 * 而且它們都符合同一個「每次加幾」的規律，答案也符合這個規律。
 * 只看得到 2 個數時（例如 2、4、□），可能是每次多 2，也可能是每次乘 2，答案不唯一。
 */
export function isUniquelyDetermined(question: Question): boolean {
  const { terms, blankIndex, step, answer } = question;
  if (step === 0) return false;
  const known = terms.map((value, index) => ({ value, index })).filter((t) => t.index !== blankIndex);
  if (known.length < 3) return false;
  const first = known[0]!;
  const consistent = known.every((t) => t.value === first.value + (t.index - first.index) * step);
  return consistent && answer === first.value + (blankIndex - first.index) * step;
}
