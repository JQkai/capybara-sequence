import type { Question } from './types';

/** 用孩子聽得懂的話說出規律，例如「每次多 5」。依課綱 R-3-2 備註，不使用公式。 */
export function describeRule(step: number): string {
  return step > 0 ? `每次多 ${step}` : `每次少 ${-step}`;
}

export interface Explanation {
  /** 規律，例如「每次多 5」 */
  rule: string;
  /** 從看得到的數推到空格，例如「15 再多 5 是 20」「比 50 少 10 是 40」 */
  reason: string;
  /** 乘法數列才有，用「倍」說明答案，例如「4 的 5 倍是 20」（N-2-6） */
  times?: string;
}

/** 從 from 加上 diff 得到 to，說成「15 再多 5 是 20」或「比 50 少 10 是 40」 */
function describeStep(from: number, diff: number, to: number | string): string {
  // 數字前後留空格（「是 20」），文字不留（「是多少」）
  const target = typeof to === 'number' ? ` ${to}` : to;
  return diff > 0 ? `${from} 再多 ${diff} 是${target}` : `比 ${from} 少 ${-diff} 是${target}`;
}

/**
 * 從空格旁邊看得到的數往空格推：空格前面有數就從前一個往後推，空格在第一個就從第二個往回推。
 * to 傳答案就是說明，傳「多少」就是引導孩子自己算的提示。
 */
export function reasonFor(question: Question, to: number | string): string {
  const { terms, blankIndex, step } = question;
  return blankIndex > 0
    ? describeStep(terms[blankIndex - 1]!, step, to)
    : describeStep(terms[1]!, -step, to);
}

export function explain(question: Question): Explanation {
  const { answer, step, timesOf } = question;
  const reason = reasonFor(question, answer);
  return {
    rule: describeRule(step),
    reason,
    ...(timesOf ? { times: `${timesOf} 的 ${answer / timesOf} 倍是 ${answer}` } : {}),
  };
}
