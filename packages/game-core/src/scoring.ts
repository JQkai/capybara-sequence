import { LEVELS } from './levels';
import type { Level, Mode } from './types';

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

/** 困難版要簡單版拿到幾顆星才開放；天才版要困難版拿到幾顆星才開放 */
export const MODE_UNLOCK_STARS = 2;

/** 進度紀錄的 key：簡單版沿用關卡 id（和舊紀錄相容），其他難度加上後綴，例如「1a-to10@hard」 */
export function starsKey(levelId: string, mode: Mode): string {
  return mode === 'easy' ? levelId : `${levelId}@${mode}`;
}

/**
 * 某個難度的關卡能不能玩：
 * 簡單版依地圖順序解鎖（見 isUnlocked）；困難版要這關的簡單版拿到 2 顆星；天才版要這關的困難版拿到 2 顆星。
 * bestStars 的 key 用 starsKey。
 */
export function isPlayable(level: Level, mode: Mode, bestStars: Record<string, number>, levels: Level[] = LEVELS): boolean {
  if (mode === 'easy') return isUnlocked(level, bestStars, levels);
  const previous = mode === 'hard' ? 'easy' : 'hard';
  return (bestStars[starsKey(level.id, previous)] ?? 0) >= MODE_UNLOCK_STARS;
}

/**
 * 關卡有沒有解鎖：每學期的第一關一定開著（老師可以直接跳到正在教的學期），
 * 同一學期的其他關卡要前一關拿到至少 1 顆星才開。
 */
export function isUnlocked(level: Level, bestStars: Record<string, number>, levels: Level[] = LEVELS): boolean {
  const sameTerm = levels.filter((l) => l.grade === level.grade && l.semester === level.semester);
  const index = sameTerm.findIndex((l) => l.id === level.id);
  if (index <= 0) return true;
  return (bestStars[sameTerm[index - 1]!.id] ?? 0) >= 1;
}
