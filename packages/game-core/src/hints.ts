import { describeRule, knownNeighbor, reasonFor } from './explain';
import type { Question } from './types';

/** 相鄰兩個看得到的數之間的差，例如第 0、1 個數之間是「+5」 */
export interface Gap {
  /** 左邊那個數的位置；差標在它和右邊那個數之間 */
  index: number;
  label: string;
}

export interface Hint {
  /** 第 1 層：在相鄰兩個看得到的數之間標出「+5」，讓孩子自己看出規律 */
  gaps: Gap[];
  /** 第 2 層：直接說出規律，例如「每次多 5」 */
  rule: string;
  /** 第 3 層：引導孩子從旁邊的數算出空格，但不說出答案，例如「15 再多 5 是多少？」 */
  guide: string;
}

export const HINT_LEVELS = 3;

/**
 * focus 是孩子正在填的空格（不寫就是第一個空格）。
 * 如果這個空格兩邊都是空格（例如 □、□、15 的第一格），引導孩子先算旁邊有數的那一格。
 */
export function hintFor(question: Question, focus = question.blanks[0]!): Hint {
  const { terms, blanks, step } = question;
  const label = step > 0 ? `+${step}` : `−${-step}`;
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
  return { gaps, rule: describeRule(step), guide };
}
