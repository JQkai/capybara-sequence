import { describeRule, knownNeighbor, reasonFor } from './explain';
import { shownTerms } from './generator';
import type { Question } from './types';

/** 相鄰兩個數之間的差，例如第 0、1 個數之間是「+5」 */
export interface Gap {
  /** 左邊那個數的位置；差標在它和右邊那個數之間 */
  index: number;
  label: string;
}

export interface Hint {
  /** 第 1 層的提示文字，例如「看看石頭下面的數字，每兩顆差多少？」 */
  intro: string;
  /** 第 1 層：在相鄰兩個數之間標出差，讓孩子自己看出規律 */
  gaps: Gap[];
  /** 第 2 層：直接說出規律，例如「每次多 5」 */
  rule: string;
  /** 第 3 層：引導孩子算出答案，但不說出答案，例如「15 再多 5 是多少？」 */
  guide: string;
}

export const HINT_LEVELS = 3;

function diffLabel(diff: number): string {
  return diff >= 0 ? `+${diff}` : `−${-diff}`;
}

/** 完整數列每兩顆之間的差（全部一樣，例如 +5 +5 +5），排一排排好後用來讓孩子看到規律 */
export function stepGaps(question: Question): Gap[] {
  return question.terms.slice(0, -1).map((_, i) => ({ index: i, label: diffLabel(question.step) }));
}

/**
 * focus 是孩子正在填的位置（不寫就是第一個）。
 * - 補空格、選擇題：只在兩個都看得到的相鄰數之間標差；空格兩邊都是空格時（例如 □、□、15 的第一格），引導先算旁邊有數的那格
 * - 找錯誤：每兩顆之間都標出實際的差（例如 +2 +2 +3 +1），讓孩子找出差得不一樣的地方；
 *   如果寫錯的數旁邊不標，等於直接告訴孩子答案
 * - 排一排：先找最小（最大）的數，再一顆一顆往下排
 */
export function hintFor(question: Question, focus = question.blanks[0]!): Hint {
  const { terms, blanks, step } = question;
  const rule = describeRule(step);

  if (question.type === 'error') {
    const shown = shownTerms(question);
    const gaps = shown.slice(0, -1).map((value, i) => ({ index: i, label: diffLabel(shown[i + 1]! - value) }));
    // 用一對沒寫錯的相鄰數當例子，不會透露是哪一顆
    const wrongAt = blanks[0]!;
    const i = shown.findIndex((_, k) => k + 1 < shown.length && k !== wrongAt && k + 1 !== wrongAt);
    return {
      intro: '看看石頭下面的數字，哪兩顆差得不一樣？',
      gaps,
      rule,
      guide: `${shown[i]} 和 ${shown[i + 1]} 差 ${Math.abs(step)}，每兩顆都應該差 ${Math.abs(step)}，哪一顆不是？`,
    };
  }

  if (question.type === 'order') {
    const word = step > 0 ? '小' : '大';
    return {
      intro: `最${word}的數放第一顆，再從剩下的卡裡找最${word}的，一顆一顆排`,
      gaps: [],
      rule,
      guide: `第一顆是 ${terms[0]}，${reasonFor({ ...question, blanks: [1] }, 1, '多少')}？`,
    };
  }

  const label = diffLabel(step);
  const gaps: Gap[] = [];
  for (let i = 0; i < terms.length - 1; i++) {
    if (!blanks.includes(i) && !blanks.includes(i + 1)) gaps.push({ index: i, label });
  }

  let guide: string;
  if (knownNeighbor(question, focus) !== undefined) {
    guide = `${reasonFor(question, focus, '多少')}？`;
  } else {
    const neighbor = blanks.includes(focus + 1) ? focus + 1 : focus - 1;
    guide = `先算旁邊的空格：${reasonFor(question, neighbor, '多少')}？`;
  }
  return { intro: '看看石頭下面的數字，每兩顆差多少？', gaps, rule, guide };
}
