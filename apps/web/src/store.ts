import { reactive, watch } from 'vue';
import { starsKey, type Mode } from '@kidstudy/game-core';

/**
 * 存在瀏覽器的資料：進度（每關最好拿過幾顆星）和設定。
 * 無痕模式、封鎖網站資料時 localStorage 會拋錯或讀不到，這時就當作沒有紀錄，遊戲照常進行。
 */
function load<T extends object>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function persist(key: string, value: object) {
  watch(
    () => JSON.stringify(value),
    (json) => {
      try {
        localStorage.setItem(key, json);
      } catch {
        // 存不了就算了，下次開啟會從頭開始
      }
    },
  );
}

export type TermKey = '1-1' | '1-2' | '2-1' | '2-2';

export const settings = reactive(
  load('capybara-sequence:settings:v1', {
    /** 音效 */
    sound: true,
    /** 每題出現時自動朗讀 */
    autoRead: true,
    /** 地圖上目前選的學期 */
    term: '1-1' as TermKey,
    /** 地圖上目前選的難度 */
    mode: 'easy' as Mode,
  }),
);
persist('capybara-sequence:settings:v1', settings);

export const progress = reactive(
  load('capybara-sequence:progress:v1', {
    /** 每關每個難度最好拿過幾顆星，key 見 starsKey（簡單版是關卡 id，其他是「id@hard」） */
    bestStars: {} as Record<string, number>,
  }),
);
persist('capybara-sequence:progress:v1', progress);

/** 記下這回合的星星數；比以前多就更新，並回傳 true（新紀錄） */
export function recordStars(levelId: string, mode: Mode, stars: number): boolean {
  const key = starsKey(levelId, mode);
  const previous = progress.bestStars[key];
  if (previous !== undefined && stars <= previous) return false;
  progress.bestStars[key] = stars;
  return stars > (previous ?? 0);
}
