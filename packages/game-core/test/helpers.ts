import type { Question } from '../src';

/** 測試用的題目：blanks 可以是一個或多個空格位置 */
export function question(terms: number[], blanks: number | number[], extra: Partial<Question> = {}): Question {
  const list = Array.isArray(blanks) ? blanks : [blanks];
  return {
    key: 'test',
    levelId: 'test',
    mode: list.length > 1 ? 'hard' : 'easy',
    type: 'fill',
    terms,
    blanks: list,
    answers: list.map((b) => terms[b]!),
    step: terms[1]! - terms[0]!,
    choices: [],
    ...extra,
  };
}
