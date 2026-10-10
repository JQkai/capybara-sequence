import { pick, randomInt, shuffle, type Rng } from './rng';
import type { Level, Mode, Practice, Question, QuestionType, StepRule } from './types';

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

/** 每一關都有的新題型（M3）：找錯誤、排一排 */
const EXTRA_TYPES: QuestionType[] = ['error', 'order'];

/** 某個關卡在某個難度下的出題設定 */
export function settingsFor(level: Level, mode: Mode): ModeSettings {
  if (mode === 'easy') return { rules: level.rules, length: level.length, types: [...level.types, ...EXTRA_TYPES] };
  const hardRules = level.hard?.rules ?? level.rules;
  const length =
    level.hard?.length ??
    HARD_LENGTHS.find((n) => hardRules.every((rule) => feasible(rule, n))) ??
    HARD_LENGTHS.at(-1)!;
  const rules =
    mode === 'hard' ? hardRules : uniqueRules(hardRules.flatMap((rule) => geniusRules(level, rule, length)));
  // 多個空格的選擇題不好操作，困難、天才版不出選擇題
  return { rules, length, types: ['fill', ...EXTRA_TYPES] };
}

export const PRACTICES: Practice[] = ['mix', 'fill', 'error', 'order'];

export const PRACTICE_NAMES: Record<Practice, string> = { mix: '混合', fill: '填空格', error: '找錯誤', order: '排一排' };

/** 練習某種題型時，這個難度會出哪些題型（填空格包含選擇題和補空格） */
export function typesFor(level: Level, mode: Mode, practice: Practice = 'mix'): QuestionType[] {
  const { types } = settingsFor(level, mode);
  if (practice === 'mix') return types;
  if (practice === 'fill') return types.filter((t) => t === 'next' || t === 'fill');
  return types.filter((t) => t === practice);
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

/**
 * 給孩子看的天才版說明，依這些關卡實際有的變化產生，例如「都有 3 個空格，有些題目還會跨過整十、往回數」。
 * 用「從別的數開始」而不是「不從倍數開始」：「倍數」是五年級才學的詞（課綱 N-5-3）。
 */
export function describeGenius(levels: Level[]): string {
  const all = levels.map(geniusTwists);
  const any = (key: keyof GeniusTwists) => all.some((t) => t[key]);
  const extras = [
    any('offStart') && '從別的數開始',
    any('crossTens') && '跨過整十',
    any('crossHundreds') && '跨過整百',
    any('descending') && '往回數',
  ].filter(Boolean);
  const blanks = `都有 ${BLANK_COUNTS.genius.max} 個空格`;
  return extras.length ? `${blanks}，有些題目還會${extras.join('、')}` : blanks;
}

/** 地圖上給孩子看的關卡說明；困難、天才版範圍或方向不同的關卡另外寫 */
export function describeLevel(level: Level, mode: Mode): string {
  return mode === 'easy' ? level.description : (level.hard?.description ?? level.description);
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

/**
 * 找錯誤題的錯數：模仿孩子常見的錯，差 1、差 2、十位寫錯。
 * 不能和數列裡其他的數一樣，也不能超出關卡範圍。
 * 只錯一個數時，其他數都符合規律，所以只有改這一個數才能讓整列符合規律，答案唯一。
 */
function makeWrong(rng: Rng, terms: number[], index: number, step: number, range: { min: number; max: number }): number {
  const correct = terms[index]!;
  const plausible = shuffle(rng, [
    correct + 1,
    correct - 1,
    Math.abs(step) > 2 ? correct + 2 : undefined,
    Math.abs(step) > 2 ? correct - 2 : undefined,
    Math.abs(step) < 10 ? correct + 10 : undefined,
    Math.abs(step) < 10 ? correct - 10 : undefined,
  ]);
  const fallback: number[] = [];
  for (let k = 3; k <= range.max; k++) fallback.push(correct + k, correct - k);
  for (const candidate of [...plausible, ...fallback]) {
    if (candidate === undefined || candidate === correct) continue;
    if (candidate < Math.max(0, range.min) || candidate > range.max) continue;
    if (terms.includes(candidate)) continue;
    return candidate;
  }
  throw new Error(`找不到合適的錯數：${terms.join(',')} 第 ${index} 個`);
}

/** 把數字卡打亂，而且不能剛好是排好的順序 */
function shuffleCards(rng: Rng, terms: number[]): number[] {
  for (;;) {
    const cards = shuffle(rng, terms);
    if (cards.some((c, i) => c !== terms[i])) return cards;
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
  else if (type === 'order') blanks = terms.map((_, i) => i);
  else if (type === 'error') blanks = [randomInt(rng, 0, settings.length - 1)];
  else if (mode === 'easy') blanks = [randomInt(rng, level.blankFirst ? 0 : 1, settings.length - 1)];
  else blanks = pickBlanks(rng, settings.length, mode);

  const answers = blanks.map((i) => terms[i]!);
  const choices = type === 'next' ? makeChoices(level, terms, answers[0]!, rule.step, rng) : [];
  const wrong = type === 'error' ? makeWrong(rng, terms, blanks[0]!, rule.step, levelRange(level, mode)) : undefined;
  const cards = type === 'order' ? shuffleCards(rng, terms) : undefined;

  return {
    key: `${mode}:${type}:${terms.join(',')}:${blanks.join('|')}:${wrong ?? ''}:${cards?.join(',') ?? ''}`,
    levelId: level.id,
    mode,
    type,
    terms,
    blanks,
    answers,
    ...(wrong !== undefined ? { wrong } : {}),
    ...(cards ? { cards } : {}),
    step: rule.step,
    ...(rule.times ? { timesOf: Math.abs(rule.step) } : {}),
    choices,
  };
}

/** 找錯誤題畫面上顯示的數列：寫錯的位置換成錯數；其他題型就是完整數列 */
export function shownTerms(question: Question): number[] {
  if (question.type !== 'error' || question.wrong === undefined) return question.terms;
  const shown = [...question.terms];
  shown[question.blanks[0]!] = question.wrong;
  return shown;
}

/**
 * 題目難度排序，數字越大越難：
 * 選擇題 < 排一排 < 找錯誤（寫錯在中間）< 一個空格（最後 < 中間 < 第一個）
 * < 找錯誤（寫錯在頭尾）< 兩個空格 < 三個空格；空格在開頭的再難一點。
 * 找錯誤寫錯在頭尾時，只有一個差和規律不同，要先判斷是頭還是尾寫錯，比寫錯在中間難。
 */
export function questionRank(question: Question): number {
  const { type, blanks, terms } = question;
  if (type === 'next') return 0;
  if (type === 'order') return 1;
  if (type === 'error') {
    const at = blanks[0]!;
    return at === 0 || at === terms.length - 1 ? 6 : 2;
  }
  if (blanks.length === 1) {
    const blank = blanks[0]!;
    if (blank === terms.length - 1) return 3;
    return blank > 0 ? 4 : 5;
  }
  return 7 + (blanks.length - 2) * 2 + (blanks.includes(0) ? 1 : 0);
}

export interface RoundOptions {
  count?: number;
  mode?: Mode;
  practice?: Practice;
}

/** 產生一回合的題目：每種題型至少出現一次（題數夠的話）、同一回合不重複，並且由易到難排列 */
export function generateRound(level: Level, rng: Rng, options: RoundOptions = {}): Question[] {
  const { count = 5, mode = 'easy', practice = 'mix' } = options;
  const available = typesFor(level, mode, practice);
  // 先讓每種題型各出一題，剩下的題數隨機挑題型
  const types = shuffle(rng, available).slice(0, count);
  while (types.length < count) types.push(pick(rng, available));
  const questions: Question[] = [];
  const seen = new Set<string>();
  for (const type of types) {
    let question = generateQuestion(level, rng, { type, mode });
    for (let tries = 0; seen.has(question.key) && tries < 50; tries++) {
      question = generateQuestion(level, rng, { type, mode });
    }
    seen.add(question.key);
    questions.push(question);
  }
  return questions.sort((a, b) => questionRank(a) - questionRank(b));
}
