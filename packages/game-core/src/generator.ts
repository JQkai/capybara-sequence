import { pick, randomInt, shuffle, type Rng } from './rng';
import type { Level, Mode, Question, QuestionType, StepRule } from './types';

/** 列出所有合法的第一個數，讓整個數列都落在規則範圍內並符合限制 */
export function startCandidates(rule: StepRule, length: number): number[] {
  if (rule.step === 0 || !Number.isInteger(rule.step)) {
    throw new Error(`step 必須是不為 0 的整數：${rule.step}`);
  }
  const size = Math.abs(rule.step);
  const span = (length - 1) * size;
  const [lo, hi] = rule.step > 0 ? [rule.min, rule.max - span] : [rule.min + span, rule.max];
  const result: number[] = [];
  for (let start = lo; start <= hi; start++) {
    if (rule.startMultiple && start % size !== 0) continue;
    if (rule.offStart && start % size === 0) continue;
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

/** 困難、天才版的數列長度：優先 8 個數，有規則排不下就用 7 個 */
const HARD_LENGTHS = [8, 7];
/** 空格數：困難版 2～3 個；天才版一律 3 個，讓「跨過整百」、乘法這類變化本來就多的關卡也比困難版難 */
export const BLANK_COUNTS: Record<'hard' | 'genius', { min: number; max: number }> = {
  hard: { min: 2, max: 3 },
  genius: { min: 3, max: 3 },
};

function feasible(rule: StepRule, length: number): boolean {
  return startCandidates(rule, length).length > 0;
}

/** min 和 max 之間（不含兩端）有沒有 every 的倍數；沒有的話數列不可能真的「跨過」整十、整百 */
function hasInteriorMultiple(min: number, max: number, every: number): boolean {
  return Math.floor((max - 1) / every) * every > min;
}

/**
 * 天才版的變化：在困難版的規則上混合「不從倍數開始」「跨過整十、整百」「往回數」。
 * - 不從倍數開始：只用在 2、5、10、100 個一數；乘法數列不用，否則就不是那一段乘法了。
 *   一年級只開放給設定 geniusOffStart 的關卡（百數表之後）
 * - 跨過：數列的範圍裡要真的有整十、整百可以跨（例如「數到 10」最大就是 10，跨不過去）
 * - 往回數：只用在二年級（課綱 N-2-1「從某數開始前後數數」）
 * 原本的規則也留著一起混合出題，數列才不會太單調。
 */
function geniusRules(level: Level, base: StepRule, length: number): StepRule[] {
  const size = Math.abs(base.step);
  const crossEvery = size < 10 ? 10 : size < 100 ? 100 : undefined;
  const offStartAllowed = level.hard?.geniusOffStart ?? level.grade === 2;
  const offs = base.startMultiple && !base.times && offStartAllowed ? [false, true] : [false];
  const descs = level.grade === 2 && base.step > 0 ? [false, true] : [false];
  const crosses =
    crossEvery && !base.crossEvery && hasInteriorMultiple(base.min, base.max, crossEvery) ? [false, true] : [false];

  const variants: StepRule[] = [];
  for (const off of offs) {
    for (const desc of descs) {
      for (const cross of crosses) {
        const rule: StepRule = { ...base, step: desc ? -base.step : base.step };
        if (off) {
          delete rule.startMultiple;
          rule.offStart = true;
        }
        if (cross) rule.crossEvery = crossEvery;
        if (feasible(rule, length)) variants.push(rule);
      }
    }
  }
  return variants;
}

function uniqueRules(rules: StepRule[]): StepRule[] {
  const seen = new Set<string>();
  return rules.filter((rule) => {
    const key = JSON.stringify(rule, Object.keys(rule).sort());
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export interface ModeSettings {
  rules: StepRule[];
  length: number;
  types: QuestionType[];
}

/** 某個關卡在某個難度下的出題設定 */
export function settingsFor(level: Level, mode: Mode): ModeSettings {
  if (mode === 'easy') return { rules: level.rules, length: level.length, types: level.types };
  const hardRules = level.hard?.rules ?? level.rules;
  const length =
    level.hard?.length ??
    HARD_LENGTHS.find((n) => hardRules.every((rule) => feasible(rule, n))) ??
    HARD_LENGTHS.at(-1)!;
  const rules =
    mode === 'hard' ? hardRules : uniqueRules(hardRules.flatMap((rule) => geniusRules(level, rule, length)));
  // 多個空格的選擇題不好操作，困難、天才版只出補空格
  return { rules, length, types: ['fill'] };
}

export interface GeniusTwists {
  offStart: boolean;
  crossTens: boolean;
  crossHundreds: boolean;
  descending: boolean;
}

/** 這關的天才版比困難版多了哪些變化 */
export function geniusTwists(level: Level): GeniusTwists {
  const hard = settingsFor(level, 'hard').rules;
  const genius = settingsFor(level, 'genius').rules;
  const added = (r: StepRule) => !hard.some((h) => h.step === r.step && h.crossEvery === r.crossEvery);
  return {
    offStart: genius.some((r) => r.offStart),
    crossTens: genius.some((r) => r.crossEvery === 10 && added(r)),
    crossHundreds: genius.some((r) => r.crossEvery === 100 && added(r)),
    descending: genius.some((r) => !hard.some((h) => h.step === r.step)),
  };
}

/** 給孩子看的天才版說明，依這些關卡實際有的變化產生，例如「一律 3 個空格，還會跨過整十、往回數」 */
export function describeGenius(levels: Level[]): string {
  const all = levels.map(geniusTwists);
  const any = (key: keyof GeniusTwists) => all.some((t) => t[key]);
  const extras = [
    any('offStart') && '不從倍數開始',
    any('crossTens') && '跨過整十',
    any('crossHundreds') && '跨過整百',
    any('descending') && '往回數',
  ].filter(Boolean);
  const blanks = `一律 ${BLANK_COUNTS.genius.max} 個空格`;
  return extras.length ? `${blanks}，有些題目還會${extras.join('、')}` : blanks;
}

/** 關卡設定有沒有出不了題的規則；有的話丟出錯誤 */
export function validateLevel(level: Level): void {
  if (level.length < 4) throw new Error(`${level.id}：數列至少要 4 個數，空格以外才有 3 個數可以看出規律`);
  if (level.types.length === 0) throw new Error(`${level.id}：沒有設定題型`);
  if (level.choiceCount < 2) throw new Error(`${level.id}：選項至少要 2 個`);
  for (const mode of ['easy', 'hard', 'genius'] as const) {
    const { rules, length } = settingsFor(level, mode);
    if (mode !== 'easy' && (length < 7 || length > 8)) throw new Error(`${level.id}：${mode} 版要 7～8 個數`);
    if (rules.length === 0) throw new Error(`${level.id}：${mode} 版沒有規則`);
    for (const rule of rules) {
      if (!feasible(rule, length)) throw new Error(`${level.id}：${mode} 版規則 ${JSON.stringify(rule)} 出不了題`);
    }
  }
}

/** 關卡裡所有數的範圍；錯誤選項也不能超出這個範圍 */
export function levelRange(level: Level, mode: Mode = 'easy'): { min: number; max: number } {
  const { rules } = settingsFor(level, mode);
  return {
    min: Math.min(...rules.map((rule) => rule.min)),
    max: Math.max(...rules.map((rule) => rule.max)),
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

/**
 * 多個空格的位置合不合理：
 * 看得到的數至少 3 個（答案才唯一）、不能連續三格空格、
 * 至少有一對相鄰的數兩個都看得到（孩子才看得出每次差多少，第 1 層提示也才有東西可以標）。
 */
export function validBlanks(blanks: number[], length: number): boolean {
  const set = new Set(blanks);
  if (length - set.size < 3) return false;
  for (let i = 0; i + 2 < length; i++) {
    if (set.has(i) && set.has(i + 1) && set.has(i + 2)) return false;
  }
  for (let i = 0; i + 1 < length; i++) {
    if (!set.has(i) && !set.has(i + 1)) return true;
  }
  return false;
}

function pickBlanks(rng: Rng, length: number, mode: 'hard' | 'genius'): number[] {
  const count = randomInt(rng, BLANK_COUNTS[mode].min, BLANK_COUNTS[mode].max);
  const positions = Array.from({ length }, (_, i) => i);
  for (;;) {
    const blanks = shuffle(rng, positions).slice(0, count).sort((a, b) => a - b);
    if (validBlanks(blanks, length)) return blanks;
  }
}

export interface QuestionOptions {
  type?: QuestionType;
  mode?: Mode;
}

export function generateQuestion(level: Level, rng: Rng, options: QuestionOptions = {}): Question {
  const mode = options.mode ?? 'easy';
  const settings = settingsFor(level, mode);
  const type = options.type ?? pick(rng, settings.types);
  const rule = pick(rng, settings.rules);
  const start = pick(rng, startCandidates(rule, settings.length));
  const terms = Array.from({ length: settings.length }, (_, i) => start + i * rule.step);

  let blanks: number[];
  if (type === 'next') blanks = [settings.length - 1];
  else if (mode === 'easy') blanks = [randomInt(rng, level.blankFirst ? 0 : 1, settings.length - 1)];
  else blanks = pickBlanks(rng, settings.length, mode);

  const answers = blanks.map((i) => terms[i]!);
  const choices = type === 'next' ? makeChoices(level, terms, answers[0]!, rule.step, rng) : [];

  return {
    key: `${mode}:${type}:${terms.join(',')}:${blanks.join('|')}`,
    levelId: level.id,
    mode,
    type,
    terms,
    blanks,
    answers,
    step: rule.step,
    ...(rule.times ? { timesOf: Math.abs(rule.step) } : {}),
    choices,
  };
}

/**
 * 題目難度排序，數字越大越難：
 * 選擇題 < 一個空格（最後 < 中間 < 第一個）< 兩個空格 < 三個空格；空格在開頭的再難一點
 */
export function questionRank(question: Question): number {
  const { type, blanks, terms } = question;
  if (type === 'next') return 0;
  if (blanks.length === 1) {
    const blank = blanks[0]!;
    if (blank === terms.length - 1) return 1;
    return blank > 0 ? 2 : 3;
  }
  return 4 + (blanks.length - 2) * 2 + (blanks.includes(0) ? 1 : 0);
}

export interface RoundOptions {
  count?: number;
  mode?: Mode;
}

/** 產生一回合的題目：各題型都會出現、同一回合不重複，並且由易到難排列 */
export function generateRound(level: Level, rng: Rng, options: RoundOptions = {}): Question[] {
  const { count = 5, mode = 'easy' } = options;
  const { types } = settingsFor(level, mode);
  const questions: Question[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < count; i++) {
    const type = types[i % types.length]!;
    let question = generateQuestion(level, rng, { type, mode });
    for (let tries = 0; seen.has(question.key) && tries < 50; tries++) {
      question = generateQuestion(level, rng, { type, mode });
    }
    seen.add(question.key);
    questions.push(question);
  }
  return questions.sort((a, b) => questionRank(a) - questionRank(b));
}
