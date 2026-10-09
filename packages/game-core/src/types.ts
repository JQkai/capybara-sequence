/** 題型：next＝選出下一個數（選擇題）；fill＝補空格（用數字鍵盤輸入） */
export type QuestionType = 'next' | 'fill';

/**
 * 難度：
 * easy＝5 個數、1 個空格；
 * hard＝7～8 個數、2～3 個空格，可以連續兩格、可以在開頭；
 * genius＝一律 3 個空格，再混合「不從倍數開始」「跨過整十整百」「往回數」。
 */
export type Mode = 'easy' | 'hard' | 'genius';

/** 一種數數規則，例如「從 1 到 100 之間，5 個一數」 */
export interface StepRule {
  /** 每次加多少；負數代表每次減（往回數） */
  step: number;
  /** 數列中每個數的最小值 */
  min: number;
  /** 數列中每個數的最大值 */
  max: number;
  /** 第一個數必須是 |step| 的倍數，例如 5 個一數從 5、10、15 開始 */
  startMultiple?: boolean;
  /** 第一個數必須「不是」|step| 的倍數，例如 5 個一數從 3 開始：3、8、13（天才版） */
  offStart?: boolean;
  /** 數列必須跨過這個數的倍數，例如 100 代表要跨過整百（98、99、100、101） */
  crossEvery?: number;
  /** 乘法數列：每個數都是 |step| 的幾倍，說明時會補上「4 的 5 倍是 20」 */
  times?: boolean;
}

export interface Level {
  id: string;
  grade: 1 | 2;
  /** 1＝上學期，2＝下學期 */
  semester: 1 | 2;
  title: string;
  description: string;
  /** 對應的 108 課綱學習內容條目 */
  curriculum: string[];
  /** 出題時從這些規則中隨機挑一條 */
  rules: StepRule[];
  /** 每題數列有幾個數（含空格） */
  length: number;
  types: QuestionType[];
  /** 選擇題的選項數量 */
  choiceCount: number;
  /** 簡單版補空格題的空格可不可以在第一個位置（困難、天才版一律可以） */
  blankFirst: boolean;
  /** 困難、天才版的設定；沒寫就沿用簡單版的規則，數列長度自動選 8 或 7 */
  hard?: {
    rules?: StepRule[];
    length?: number;
  };
}

export interface Question {
  /** 數列內容與空格位置相同的題目，key 也相同，用來避免同一回合重複出題 */
  key: string;
  levelId: string;
  mode: Mode;
  type: QuestionType;
  /** 完整數列（含答案） */
  terms: number[];
  /** 空格位置，由小到大；簡單版只有一個 */
  blanks: number[];
  /** 每個空格的答案，順序和 blanks 相同 */
  answers: number[];
  step: number;
  /** 乘法數列的段次，例如 4 的乘法是 4；不是乘法數列時沒有這個欄位 */
  timesOf?: number;
  /** 選擇題的選項（已打亂順序）；補空格題為空陣列 */
  choices: number[];
}
