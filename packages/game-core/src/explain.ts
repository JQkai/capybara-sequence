import { explainFree } from './free';
import type { Question } from './types';

/** 用孩子聽得懂的話說出規律，例如「每次多 5」。依課綱 R-3-2 備註，不使用公式。 */
export function describeRule(step: number): string {
  return step > 0 ? `每次多 ${step}` : `每次少 ${-step}`;
}

export interface Explanation {
  /** 規律，例如「每次多 5」 */
  rule: string;
  /**
   * 每個空格怎麼推出來，例如「15 再多 5 是 20」「比 50 少 10 是 40」。
   * 依推算的順序排列：旁邊有數的空格先說，要靠旁邊空格才推得出來的後說。
   */
  reasons: string[];
  /** 乘法數列才有，用「倍」說明每個空格的答案，例如「4 的 5 倍是 20」（N-2-6）；順序和 reasons 相同 */
  times: string[];
}

/** 從 from 加上 diff 得到 to，說成「15 再多 5 是 20」或「比 50 少 10 是 40」 */
function describeStep(from: number, diff: number, to: number | string): string {
  // 數字前後留空格（「是 20」），文字不留（「是多少」）
  const target = typeof to === 'number' ? ` ${to}` : to;
  return diff > 0 ? `${from} 再多 ${diff} 是${target}` : `比 ${from} 少 ${-diff} 是${target}`;
}

/** 空格旁邊有沒有看得到的數：回傳那個數的位置，左邊優先；兩邊都是空格時回傳 undefined */
export function knownNeighbor(question: Question, position: number): number | undefined {
  const { blanks, terms } = question;
  const isKnown = (i: number) => i >= 0 && i < terms.length && !blanks.includes(i);
  if (isKnown(position - 1)) return position - 1;
  if (isKnown(position + 1)) return position + 1;
  return undefined;
}

/**
 * 從旁邊的數推出某個空格：優先用看得到的數（左邊優先），
 * 兩邊都是空格時（連續空格在開頭，例如 □、□、15）就從旁邊那個空格的答案推。
 * to 傳答案就是說明，傳「多少」就是引導孩子自己算的提示。
 */
export function reasonFor(question: Question, position: number, to: number | string): string {
  const { terms, step } = question;
  const from = knownNeighbor(question, position) ?? (position > 0 ? position - 1 : position + 1);
  return from < position
    ? describeStep(terms[from]!, step, to)
    : describeStep(terms[from]!, -step, to);
}

export function explain(question: Question): Explanation {
  if (question.free) return { ...explainFree(question), times: [] };
  const { blanks, answers, step, timesOf } = question;
  // 排一排：每個位置都是孩子放的，說明規律就夠了
  if (question.type === 'order') return { rule: describeRule(step), reasons: [], times: [] };
  // 兩邊都看不到數的空格，要等旁邊的空格算出來才能推，所以先說明旁邊有數的空格
  const order = [...blanks.keys()].sort(
    (a, b) =>
      Number(knownNeighbor(question, blanks[a]!) === undefined) -
      Number(knownNeighbor(question, blanks[b]!) === undefined),
  );
  const reasons: string[] = [];
  const times: string[] = [];
  for (const k of order) {
    reasons.push(reasonFor(question, blanks[k]!, answers[k]!));
    if (timesOf) times.push(`${timesOf} 的 ${answers[k]! / timesOf} 倍是 ${answers[k]}`);
  }
  return { rule: describeRule(step), reasons, times };
}
