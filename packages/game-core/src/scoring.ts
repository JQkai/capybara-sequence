import type { Mode } from './types';

/** 每題最多可以答幾次：第一次答錯會給提示再試一次 */
export const MAX_ATTEMPTS = 2;

export interface QuestionResult {
  correct: boolean;
  /** 答了幾次（1 或 2） */
  attempts: number;
  /** 用了幾層提示 */
  hintsUsed: number;
}

/** 一題的分數：自己第一次就答對 2 分；用了提示或第二次才答對 1 分；答錯 0 分 */
export function questionPoints(result: QuestionResult): number {
  if (!result.correct) return 0;
  return result.attempts === 1 && result.hintsUsed === 0 ? 2 : 1;
}

/**
 * 一回合拿到幾顆星（0～3）。依分數佔滿分的比例：
 * 3 星：90% 以上（5 題最多只有 1 題需要幫忙）；2 星：60% 以上；1 星：30% 以上。
 */
export function starsFor(results: QuestionResult[]): number {
  if (results.length === 0) return 0;
  const ratio = results.reduce((sum, r) => sum + questionPoints(r), 0) / (results.length * 2);
  if (ratio >= 0.9) return 3;
  if (ratio >= 0.6) return 2;
  if (ratio >= 0.3) return 1;
  return 0;
}

export const MODES: Mode[] = ['easy', 'hard', 'genius'];

export const MODE_NAMES: Record<Mode, string> = { easy: '簡單', hard: '困難', genius: '天才' };

/** 進度紀錄的 key：簡單版沿用關卡 id（和舊紀錄相容），其他難度加上後綴，例如「1a-to10@hard」 */
export function starsKey(levelId: string, mode: Mode): string {
  return mode === 'easy' ? levelId : `${levelId}@${mode}`;
}
