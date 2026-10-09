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
function describeStep(from: number, diff: number, to: number): string {
  return diff > 0 ? `${from} 再多 ${diff} 是 ${to}` : `比 ${from} 少 ${-diff} 是 ${to}`;
}

export function explain(question: Question): Explanation {
  const { terms, blankIndex, answer, step, timesOf } = question;
  // 從空格旁邊看得到的數往空格推：空格前面有數就從前一個往後推，空格在第一個就從第二個往回推
  const reason =
    blankIndex > 0
      ? describeStep(terms[blankIndex - 1]!, step, answer)
      : describeStep(terms[1]!, -step, answer);
  return {
    rule: describeRule(step),
    reason,
    ...(timesOf ? { times: `${timesOf} 的 ${answer / timesOf} 倍是 ${answer}` } : {}),
  };
}
