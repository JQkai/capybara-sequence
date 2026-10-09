import { pick, randomInt, shuffle, type Rng } from './rng';
import type { Level, Question, QuestionType, StepRule } from './types';

/** 列出所有合法的第一個數，讓整個數列都落在規則範圍內並符合限制 */
export function startCandidates(rule: StepRule, length: number): number[] {
  if (rule.step === 0 || !Number.isInteger(rule.step)) {
    throw new Error(`step 必須是不為 0 的整數：${rule.step}`);
  }
  const span = (length - 1) * Math.abs(rule.step);
  const [lo, hi] = rule.step > 0 ? [rule.min, rule.max - span] : [rule.min + span, rule.max];
  const result: number[] = [];
  for (let start = lo; start <= hi; start++) {
    if (rule.startMultiple && start % Math.abs(rule.step) !== 0) continue;
    if (rule.crossEvery) {
      const end = start + (length - 1) * rule.step;
      const lower = Math.min(start, end);
      const upper = Math.max(start, end);
      if (Math.floor(lower / rule.crossEvery) === Math.floor(upper / rule.crossEvery)) continue;
    }
    result.push(start);
  }
  return result;
}

/** 關卡設定有沒有出不了題的規則；有的話丟出錯誤 */
export function validateLevel(level: Level): void {
  if (level.length < 4) throw new Error(`${level.id}：數列至少要 4 個數，空格以外才有 3 個數可以看出規律`);
  if (level.types.length === 0) throw new Error(`${level.id}：沒有設定題型`);
  if (level.choiceCount < 2) throw new Error(`${level.id}：選項至少要 2 個`);
  for (const rule of level.rules) {
    if (startCandidates(rule, level.length).length === 0) {
      throw new Error(`${level.id}：規則 ${JSON.stringify(rule)} 出不了題`);
    }
  }
}

/** 關卡裡所有數的範圍；錯誤選項也不能超出這個範圍 */
export function levelRange(level: Level): { min: number; max: number } {
  return {
    min: Math.min(...level.rules.map((rule) => rule.min)),
    max: Math.max(...level.rules.map((rule) => rule.max)),
  };
}

/**
 * 產生選擇題的選項。錯誤選項模仿孩子常見的錯誤：
 * 以為是 1 個一數、多跳一次、差 1、十位算錯。
 */
function makeChoices(level: Level, terms: number[], answer: number, step: number, rng: Rng): number[] {
  const last = terms[terms.length - 2]!;
  const visible = new Set(terms.filter((_, i) => i !== terms.length - 1));
  const { min, max } = levelRange(level);

  const plausible = shuffle(rng, [
    step !== 1 ? last + 1 : undefined,
    step !== -1 ? last - 1 : undefined,
    answer + step,
    answer + 1,
    answer - 1,
    Math.abs(step) < 10 ? answer + 10 : undefined,
    Math.abs(step) < 10 ? answer - 10 : undefined,
  ]);
  const fallback: number[] = [];
  for (let k = 2; k <= max; k++) fallback.push(answer + k, answer - k);

  const wrong: number[] = [];
  for (const candidate of [...plausible, ...fallback]) {
    if (wrong.length === level.choiceCount - 1) break;
    if (candidate === undefined || candidate === answer) continue;
    if (candidate < min || candidate > max) continue;
    if (visible.has(candidate) || wrong.includes(candidate)) continue;
    wrong.push(candidate);
  }
  return shuffle(rng, [answer, ...wrong]);
}

export function generateQuestion(level: Level, rng: Rng, type?: QuestionType): Question {
  const questionType = type ?? pick(rng, level.types);
  const rule = pick(rng, level.rules);
  const start = pick(rng, startCandidates(rule, level.length));
  const terms = Array.from({ length: level.length }, (_, i) => start + i * rule.step);

  const blankIndex =
    questionType === 'next'
      ? level.length - 1
      : randomInt(rng, level.blankFirst ? 0 : 1, level.length - 1);
  const answer = terms[blankIndex]!;
  const choices = questionType === 'next' ? makeChoices(level, terms, answer, rule.step, rng) : [];

  return {
    key: `${questionType}:${terms.join(',')}:${blankIndex}`,
    levelId: level.id,
    type: questionType,
    terms,
    blankIndex,
    answer,
    step: rule.step,
    ...(rule.times ? { timesOf: Math.abs(rule.step) } : {}),
    choices,
  };
}

/**
 * 題目難度，數字越大越難：
 * 選擇題 < 補空格（空格在最後）< 補空格（空格在中間）< 補空格（空格在第一個）
 */
export function difficulty(question: Question): number {
  if (question.type === 'next') return 0;
  if (question.blankIndex === question.terms.length - 1) return 1;
  return question.blankIndex > 0 ? 2 : 3;
}

/** 產生一回合的題目：各題型都會出現、同一回合不重複，並且由易到難排列 */
export function generateRound(level: Level, rng: Rng, count = 5): Question[] {
  const types = Array.from({ length: count }, (_, i) => level.types[i % level.types.length]!);
  const questions: Question[] = [];
  const seen = new Set<string>();
  for (const type of types) {
    let question = generateQuestion(level, rng, type);
    for (let tries = 0; seen.has(question.key) && tries < 50; tries++) {
      question = generateQuestion(level, rng, type);
    }
    seen.add(question.key);
    questions.push(question);
  }
  return questions.sort((a, b) => difficulty(a) - difficulty(b));
}
