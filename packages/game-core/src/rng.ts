/** 回傳 [0, 1) 的亂數。可以指定種子，讓測試和重播得到相同的題目。 */
export type Rng = () => number;

/** mulberry32：簡單、快速、可指定種子的亂數產生器 */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 回傳 min 到 max 之間的整數（含兩端） */
export function randomInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick: 陣列是空的');
  return items[randomInt(rng, 0, items.length - 1)]!;
}

export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(rng, 0, i);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}
