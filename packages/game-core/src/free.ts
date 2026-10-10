/**
 * 自由模式：不分年級，規律種類比課本多，數字在 1000 以內。
 *
 * 規律種類一多，同一串數可能符合不只一種規律（例如 1、2、4、□ 可以是「每次乘 2」得 8，
 * 也可以是「差越來越大」得 7）。所以每出一題，都用 predict() 把每一種規律套用一次：
 * 孩子會先想到比較簡單的規律，所以只要比這題簡單（或一樣難）的規律算出不同的答案，這題就不出。
 */
import { pick, randomInt, shuffle, type Rng } from './rng';
import type { Question, QuestionType } from './types';

export type FamilyId =
  | 'arith'
  | 'alternate'
  | 'growing'
  | 'multiply'
  | 'halve'
  | 'affine'
  | 'fibonacci'
  | 'interleave'
  | 'square';

/** 給孩子、老師勾選用的四大類 */
export type FamilyGroup = 'basic' | 'growing' | 'multiply' | 'advanced';

export const FAMILY_GROUPS: Record<FamilyGroup, { name: string; families: FamilyId[] }> = {
  basic: { name: '等差、輪流加', families: ['arith', 'alternate'] },
  growing: { name: '差越來越大', families: ['growing'] },
  multiply: { name: '乘幾倍、變一半', families: ['multiply', 'halve'] },
  advanced: { name: '進階規律', families: ['affine', 'fibonacci', 'interleave', 'square'] },
};

export const ALL_FAMILIES: FamilyId[] = Object.values(FAMILY_GROUPS).flatMap((g) => g.families);

/** 規律的難度：數字越小越簡單，孩子越容易先想到 */
export const FAMILY_RANK: Record<FamilyId, number> = {
  arith: 1,
  alternate: 2,
  growing: 2,
  multiply: 3,
  halve: 3,
  affine: 4,
  fibonacci: 4,
  interleave: 4,
  square: 4,
};

/**
 * 一個規律（不含起點）：
 * arith [d]；alternate [a, b]；growing [k]（每次多的數一次比一次多 k）；multiply [r]；halve []；
 * affine [a, c]（乘 a 再加 c）；fibonacci []；interleave [p, q]（單數位置每次多 p、雙數位置每次多 q）；square []
 */
export interface PatternSpec {
  family: FamilyId;
  params: number[];
}

// ─── 給孩子看的規律說明 ───

function signed(word: '加' | '多', n: number): string {
  if (word === '加') return n >= 0 ? `加 ${n}` : `減 ${-n}`;
  return n >= 0 ? `多 ${n}` : `少 ${-n}`;
}

export function describeSpec(spec: PatternSpec, terms?: number[]): string {
  const [x = 0, y = 0] = spec.params;
  switch (spec.family) {
    case 'arith':
      return `每次${signed('多', x)}`;
    case 'alternate':
      return `${signed('加', x)}、${signed('加', y)} 輪流`;
    case 'growing':
      return x > 0 ? `每次多的數，一次比一次多 ${x}` : `每次多的數，一次比一次少 ${-x}`;
    case 'multiply':
      return `每次乘 ${x}`;
    case 'halve':
      return '每次變成一半';
    case 'affine':
      return `每次乘 ${x} 再${signed('加', y)}`;
    case 'fibonacci':
      return '前面兩個數加起來';
    case 'interleave':
      return `第 1、3、5…個每次${signed('多', x)}；第 2、4、6…個每次${signed('多', y)}`;
    case 'square': {
      const n = terms ? Math.sqrt(terms[0]!) : NaN;
      // 當錯誤選項時第一個數可能不是平方數，改用一般的說法
      return Number.isInteger(n)
        ? `${n}×${n}、${n + 1}×${n + 1}、${n + 2}×${n + 2}…`
        : '每個數都是一個數自己乘自己（像 4×4、5×5）';
    }
  }
}

/** 照這個規律、用前面的數算，第 i 個數應該是多少；算不出來時回傳 null */
function expectedAt(spec: PatternSpec, terms: number[], i: number): number | null {
  const [x = 0, y = 0] = spec.params;
  const p1 = terms[i - 1];
  const p2 = terms[i - 2];
  switch (spec.family) {
    case 'arith':
      return p1 === undefined ? null : p1 + x;
    case 'alternate':
      return p1 === undefined ? null : p1 + (i % 2 === 1 ? x : y);
    case 'growing':
      return p1 === undefined || p2 === undefined ? null : p1 + (p1 - p2) + x;
    case 'multiply':
      return p1 === undefined ? null : p1 * x;
    case 'halve':
      return p1 === undefined ? null : p1 / 2;
    case 'affine':
      return p1 === undefined ? null : p1 * x + y;
    case 'fibonacci':
      return p1 === undefined || p2 === undefined ? null : p1 + p2;
    case 'interleave':
      return p2 === undefined ? null : p2 + (i % 2 === 0 ? x : y);
    case 'square': {
      const n = Math.sqrt(terms[0]!);
      return Number.isInteger(n) ? (n + i) ** 2 : null;
    }
  }
}

/** 說說規律的第 3 層提示：拿一個錯誤選項，照它算到第一個對不上的地方 */
function mismatchHint(spec: PatternSpec, terms: number[]): string | null {
  for (let i = 1; i < terms.length; i++) {
    const expected = expectedAt(spec, terms, i);
    if (expected !== null && expected !== terms[i]) {
      return `試試「${describeSpec(spec, terms)}」：照它算，第 ${i + 1} 個應該是 ${expected}，可是這裡是 ${terms[i]}，所以不是它。`;
    }
  }
  return null;
}

// ─── 照規律產生數列 ───

/** 費氏數：F(-1)=1、F(0)=0、F(1)=1、F(2)=1…，前兩個數加起來的數列第 i 個 = F(i-1)·t0 + F(i)·t1 */
function fib(i: number): number {
  if (i < 0) return 1;
  let a = 0;
  let b = 1;
  for (let k = 0; k < i; k++) [a, b] = [b, a + b];
  return a;
}

/** 線性規律的基底：第 i 個數 = Σ 參數 × 基底；用來產生數列，也用來從看得到的數推算 */
const LINEAR_BASIS: Partial<Record<FamilyId, (i: number) => number[]>> = {
  arith: (i) => [1, i],
  alternate: (i) => [1, Math.ceil(i / 2), Math.floor(i / 2)],
  growing: (i) => [1, i, (i * (i - 1)) / 2],
  fibonacci: (i) => [fib(i - 1), fib(i)],
  interleave: (i) => (i % 2 === 0 ? [1, i / 2, 0, 0] : [0, 0, 1, (i - 1) / 2]),
};

function strictlyMonotonic(terms: number[]): boolean {
  const up = terms.every((t, i) => i === 0 || t > terms[i - 1]!);
  const down = terms.every((t, i) => i === 0 || t < terms[i - 1]!);
  return up || down;
}

interface Generated {
  spec: PatternSpec;
  terms: number[];
}

function inRange(terms: number[], max: number): boolean {
  return terms.every((t) => Number.isInteger(t) && t >= 0 && t <= max);
}

/** 隨機產生一個規律的數列；這個長度、範圍排不下時回傳 null */
function randomPattern(family: FamilyId, rng: Rng, length: number, max: number, maxStep: number): Generated | null {
  const idx = Array.from({ length }, (_, i) => i);
  const sign = () => (rng() < 0.5 ? 1 : -1);
  /** 給一串相對位移，挑一個起點讓整串都在 0～max 之間 */
  const place = (offsets: number[]): number[] | null => {
    const lo = -Math.min(...offsets);
    const hi = max - Math.max(...offsets);
    if (lo > hi) return null;
    const start = randomInt(rng, lo, hi);
    return offsets.map((o) => start + o);
  };

  switch (family) {
    case 'arith': {
      const limit = Math.min(maxStep, Math.floor(max / (length - 1)));
      if (limit < 1) return null;
      const d = randomInt(rng, 1, limit) * sign();
      const terms = place(idx.map((i) => i * d));
      return terms && { spec: { family, params: [d] }, terms };
    }
    case 'alternate': {
      const limit = Math.min(maxStep, Math.floor(max / length));
      if (limit < 2) return null;
      const a = randomInt(rng, 1, limit) * sign();
      let b = randomInt(rng, 1, limit) * sign();
      // a、b 一樣就是等差；a + b = 0 會一直重複兩個數
      if (b === a || a + b === 0) b = a > 0 ? a + 1 : a - 1;
      if (b === 0 || a + b === 0) return null;
      const terms = place(idx.map((i) => Math.ceil(i / 2) * a + Math.floor(i / 2) * b));
      return terms && { spec: { family, params: [a, b] }, terms };
    }
    case 'growing': {
      const k = randomInt(rng, 1, Math.max(1, Math.min(10, Math.floor(maxStep / 5))));
      const d0 = randomInt(rng, 1, Math.max(1, Math.floor(maxStep / 2)));
      const terms = place(idx.map((i) => i * d0 + (k * i * (i - 1)) / 2));
      return terms && { spec: { family, params: [k] }, terms };
    }
    case 'multiply':
    case 'halve': {
      const ratios = family === 'halve' ? [2] : [2, 3, 4, 5];
      const options = ratios.filter((r) => r ** (length - 1) <= max);
      if (options.length === 0) return null;
      const r = pick(rng, options);
      const start = randomInt(rng, 1, Math.floor(max / r ** (length - 1)));
      const up = idx.map((i) => start * r ** i);
      return family === 'halve'
        ? { spec: { family, params: [] }, terms: up.reverse() }
        : { spec: { family, params: [r] }, terms: up };
    }
    case 'affine': {
      const [a, c] = pick(rng, [
        [2, 1],
        [2, -1],
        [2, 2],
        [3, 1],
        [3, -1],
      ] as const);
      const lowest = c < 0 ? 2 : 1;
      for (let tries = 0; tries < 20; tries++) {
        let t = randomInt(rng, lowest, lowest + 9);
        const terms = [t];
        while (terms.length < length) terms.push((t = a * t + c));
        if (inRange(terms, max) && strictlyMonotonic(terms)) return { spec: { family, params: [a, c] }, terms };
      }
      return null;
    }
    case 'fibonacci': {
      for (let tries = 0; tries < 20; tries++) {
        const t0 = randomInt(rng, 1, 12);
        const t1 = randomInt(rng, t0 + 1, t0 + 12);
        const terms = idx.map((i) => fib(i - 1) * t0 + fib(i) * t1);
        if (inRange(terms, max)) return { spec: { family, params: [] }, terms };
      }
      return null;
    }
    case 'interleave': {
      const half = Math.ceil(length / 2);
      const limit = Math.min(Math.floor(maxStep / 2), Math.floor(max / (2 * half)));
      if (limit < 1) return null;
      // 一組往上、一組往下最容易看出是兩組，例如 1、50、2、45、3、40
      const p = randomInt(rng, 1, limit);
      const q = -randomInt(rng, 1, limit);
      const [x, y] = rng() < 0.5 ? [p, q] : [q, p];
      if (x === y) return null;
      const evens = place(Array.from({ length: half }, (_, k) => k * x));
      const odds = place(Array.from({ length: length - half }, (_, k) => k * y));
      if (!evens || !odds) return null;
      const terms = idx.map((i) => (i % 2 === 0 ? evens[i / 2]! : odds[(i - 1) / 2]!));
      if (new Set(terms).size !== length) return null;
      return { spec: { family, params: [x, y] }, terms };
    }
    case 'square': {
      const top = Math.floor(Math.sqrt(max)) - length + 1;
      if (top < 1) return null;
      const n0 = randomInt(rng, 1, top);
      return { spec: { family, params: [] }, terms: idx.map((i) => (n0 + i) ** 2) };
    }
  }
}

// ─── 從看得到的數推算每一種規律 ───

type Frac = [number, number];
const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
function frac(n: number, d = 1): Frac {
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(Math.abs(n), d) || 1;
  return [n / g, d / g];
}
const fadd = (a: Frac, b: Frac) => frac(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
const fsub = (a: Frac, b: Frac) => frac(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
const fmul = (a: Frac, b: Frac) => frac(a[0] * b[0], a[1] * b[1]);
const fdiv = (a: Frac, b: Frac) => frac(a[0] * b[1], a[1] * b[0]);
const isZero = (a: Frac) => a[0] === 0;

/**
 * 某種規律套在看得到的數上的結果：
 * fits＝這種規律能不能符合所有看得到的數；
 * values[i]＝第 i 個數照這種規律一定是多少；算不出唯一的值時是 null
 */
export interface Prediction {
  fits: boolean;
  values: (number | null)[];
}

const NO_FIT: Prediction = { fits: false, values: [] };

/** 線性規律：用分數做高斯消去，看每個位置能不能被看得到的數決定 */
function predictLinear(basis: (i: number) => number[], known: (number | null)[]): Prediction {
  const length = known.length;
  const n = basis(0).length;
  const rows: Frac[][] = [];
  known.forEach((v, i) => {
    if (v !== null) rows.push([...basis(i).map((x) => frac(x)), frac(v)]);
  });
  // 化成簡化列梯形
  const pivots: number[] = [];
  let r = 0;
  for (let col = 0; col < n && r < rows.length; col++) {
    const p = rows.findIndex((row, k) => k >= r && !isZero(row[col]!));
    if (p < 0) continue;
    [rows[r], rows[p]] = [rows[p]!, rows[r]!];
    const lead = rows[r]![col]!;
    rows[r] = rows[r]!.map((x) => fdiv(x, lead));
    rows.forEach((row, k) => {
      if (k === r || isZero(row[col]!)) return;
      const f = row[col]!;
      rows[k] = row.map((x, j) => fsub(x, fmul(f, rows[r]![j]!)));
    });
    pivots.push(col);
    r++;
  }
  // 0 = 非零：看得到的數彼此矛盾
  if (rows.slice(r).some((row) => !isZero(row[n]!))) return NO_FIT;

  const values = Array.from({ length }, (_, i) => {
    const u = basis(i).map((x) => frac(x));
    let value: Frac = frac(0);
    pivots.forEach((col, k) => {
      const c = u[col]!;
      if (isZero(c)) return;
      // 簡化列梯形裡每一列的主元欄位只有自己是 1，所以係數就是 u 在這一欄的值
      value = fadd(value, fmul(c, rows[k]![n]!));
      for (let j = 0; j < n; j++) u[j] = fsub(u[j]!, fmul(c, rows[k]![j]!));
    });
    return u.every(isZero) ? value : null;
  });
  // 決定得了的位置一定要是 0 以上的整數，否則這種規律對不上
  if (values.some((v) => v !== null && (v[1] !== 1 || v[0] < 0))) return NO_FIT;
  return { fits: true, values: values.map((v) => (v === null ? null : v[0])) };
}

/** 列舉參數的規律：把每一組參數都套一次，合起來看每個位置 */
function combine(sequences: number[][], length: number): Prediction {
  const valid = sequences.filter((s) => s.every((t) => Number.isInteger(t) && t >= 0));
  if (valid.length === 0) return NO_FIT;
  const values = Array.from({ length }, (_, i) => {
    const set = new Set(valid.map((s) => s[i]));
    return set.size === 1 ? valid[0]![i]! : null;
  });
  return { fits: true, values };
}

function matches(seq: number[], known: (number | null)[]): boolean {
  return known.every((v, i) => v === null || v === seq[i]);
}

/** 每次乘 r（r 可以是分數，例如一半） */
function geometricSequences(known: (number | null)[], ratios: Frac[]): number[][] {
  const anchor = known.findIndex((v) => v !== null);
  const v = known[anchor];
  if (v === undefined || v === null || v === 0) return [];
  const out: number[][] = [];
  for (const r of ratios) {
    const seq = known.map((_, i) => {
      const e = i - anchor;
      const num = e >= 0 ? v * r[0] ** e : v * r[1] ** -e;
      const den = e >= 0 ? r[1] ** e : r[0] ** -e;
      return num % den === 0 ? num / den : NaN;
    });
    if (seq.every(Number.isFinite) && matches(seq, known)) out.push(seq);
  }
  return out;
}

const UP_RATIOS: Frac[] = [2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => frac(r));
const DOWN_RATIOS: Frac[] = [2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => frac(1, r));

/** 乘 a 再加 c：從第一個看得到的數往前、往後推 */
function affineSequences(known: (number | null)[]): number[][] {
  const anchor = known.findIndex((v) => v !== null);
  if (anchor < 0) return [];
  const out: number[][] = [];
  for (const a of [2, 3, 4, 5]) {
    for (let c = -9; c <= 9; c++) {
      if (c === 0) continue;
      const seq = [...known] as number[];
      seq[anchor] = known[anchor]!;
      let ok = true;
      for (let i = anchor + 1; i < known.length; i++) seq[i] = a * seq[i - 1]! + c;
      for (let i = anchor - 1; i >= 0 && ok; i--) {
        const prev = (seq[i + 1]! - c) / a;
        if (!Number.isInteger(prev)) ok = false;
        seq[i] = prev;
      }
      if (ok && matches(seq, known)) out.push(seq);
    }
  }
  return out;
}

function squareSequences(known: (number | null)[]): number[][] {
  const out: number[][] = [];
  for (let n0 = 0; n0 <= 40; n0++) {
    const seq = known.map((_, i) => (n0 + i) ** 2);
    if (matches(seq, known)) out.push(seq);
  }
  return out;
}

/** 把某種規律套在看得到的數（看不到的是 null）上 */
export function predict(family: FamilyId, known: (number | null)[]): Prediction {
  const basis = LINEAR_BASIS[family];
  if (basis) return predictLinear(basis, known);
  const length = known.length;
  if (family === 'multiply') return combine(geometricSequences(known, UP_RATIOS), length);
  if (family === 'halve') return combine(geometricSequences(known, DOWN_RATIOS), length);
  if (family === 'affine') return combine(affineSequences(known), length);
  return combine(squareSequences(known), length);
}

/**
 * 這題的答案是不是唯一：
 * 這題的規律要能算出每個空格；比它簡單（或一樣難）的規律如果也符合，答案要一樣；
 * 比它簡單的規律算不出唯一答案時，孩子可能想成那種規律，也不出。
 */
export function freeUnique(family: FamilyId, terms: number[], blanks: number[]): boolean {
  const known = terms.map((t, i) => (blanks.includes(i) ? null : t));
  const rank = FAMILY_RANK[family];
  for (const g of ALL_FAMILIES) {
    if (FAMILY_RANK[g] > rank) continue;
    const p = predict(g, known);
    if (g === family) {
      if (!p.fits || blanks.some((b) => p.values[b] !== terms[b])) return false;
      continue;
    }
    if (!p.fits) continue;
    for (const b of blanks) {
      const v = p.values[b];
      if (v !== null && v !== undefined && v !== terms[b]) return false;
      if ((v === null || v === undefined) && FAMILY_RANK[g] < rank) return false;
    }
  }
  return true;
}

/** 找錯誤：只改寫錯的那一顆就能符合規律；改其他任何一顆都不行 */
export function freeErrorUnique(family: FamilyId, shown: number[], wrongAt: number, correct: number): boolean {
  const rank = FAMILY_RANK[family];
  for (let q = 0; q < shown.length; q++) {
    const known = shown.map((t, i) => (i === q ? null : t));
    for (const g of ALL_FAMILIES) {
      if (FAMILY_RANK[g] > rank) continue;
      const p = predict(g, known);
      if (!p.fits) continue;
      const v = p.values[q];
      if (q === wrongAt) {
        if (g === family && v !== correct) return false;
        if (v !== null && v !== undefined && v !== correct) return false;
      } else if (v !== null && v !== undefined && v !== shown[q]) {
        // 改別的位置也能符合某種規律：寫錯的不只一種可能
        return false;
      }
    }
  }
  return true;
}

/** 這個規律說明（含參數）是不是完全符合整串數 */
export function specFits(spec: PatternSpec, terms: number[]): boolean {
  const [x = 0, y = 0] = spec.params;
  const d = (i: number) => terms[i + 1]! - terms[i]!;
  const steps = terms.length - 1;
  const all = (n: number, f: (i: number) => boolean) => Array.from({ length: n }, (_, i) => i).every(f);
  switch (spec.family) {
    case 'arith':
      return all(steps, (i) => d(i) === x);
    case 'alternate':
      return all(steps, (i) => d(i) === (i % 2 === 0 ? x : y));
    case 'growing':
      return all(steps - 1, (i) => d(i + 1) - d(i) === x);
    case 'multiply':
      return all(steps, (i) => terms[i + 1] === terms[i]! * x);
    case 'halve':
      return all(steps, (i) => terms[i + 1]! * 2 === terms[i]);
    case 'affine':
      return all(steps, (i) => terms[i + 1] === terms[i]! * x + y);
    case 'fibonacci':
      return all(steps - 1, (i) => terms[i + 2] === terms[i]! + terms[i + 1]!);
    case 'interleave':
      return all(terms.length - 2, (i) => terms[i + 2]! - terms[i]! === (i % 2 === 0 ? x : y));
    case 'square': {
      const n0 = Math.round(Math.sqrt(terms[0]!));
      return terms.every((t, i) => t === (n0 + i) ** 2);
    }
  }
}

// ─── 出題設定 ───

export interface FreeSettings {
  families: FamilyId[];
  /** 數字範圍：100 或 1000 以內 */
  max: number;
  /** 等差、輪流加的差最大是多少 */
  maxStep: number;
  /** 數列長度範圍 */
  lengths: [number, number];
  /** 填空格的空格數範圍 */
  blanks: [number, number];
  types: QuestionType[];
}

export type FreePresetId = 'warm' | 'challenge' | 'brain' | 'genius';

export const FREE_TYPES: QuestionType[] = ['next', 'fill', 'error', 'order', 'rule'];

export const QUESTION_TYPE_NAMES: Record<QuestionType, string> = {
  next: '選下一個數',
  fill: '填空格',
  error: '找錯誤',
  order: '排一排',
  rule: '說說規律',
};

export const FREE_PRESETS: Record<FreePresetId, { name: string; description: string; settings: FreeSettings }> = {
  warm: {
    name: '暖身',
    description: '每次多（或少）一樣的數，100 以內',
    settings: { families: ['arith'], max: 100, maxStep: 10, lengths: [6, 6], blanks: [1, 1], types: FREE_TYPES },
  },
  challenge: {
    name: '挑戰',
    description: '差可以到 50，還有兩個數輪流加，1000 以內',
    settings: {
      families: ['arith', 'alternate'],
      max: 1000,
      maxStep: 50,
      lengths: [6, 7],
      blanks: [1, 2],
      types: FREE_TYPES,
    },
  },
  brain: {
    name: '燒腦',
    description: '再加上差越來越大、乘幾倍、變一半',
    settings: {
      families: ['arith', 'alternate', 'growing', 'multiply', 'halve'],
      max: 1000,
      maxStep: 50,
      lengths: [7, 8],
      blanks: [2, 2],
      types: FREE_TYPES,
    },
  },
  genius: {
    name: '天才',
    description: '所有規律都會出現，還有乘 2 再加 1、前兩個數加起來、平方數',
    settings: { families: ALL_FAMILIES, max: 1000, maxStep: 100, lengths: [8, 8], blanks: [2, 3], types: FREE_TYPES },
  },
};

/** 自訂設定轉成出題設定 */
export function customSettings(options: {
  groups: FamilyGroup[];
  max: 100 | 1000;
  blanks: number;
  types: QuestionType[];
}): FreeSettings {
  const families = options.groups.flatMap((g) => FAMILY_GROUPS[g].families);
  return {
    families: families.length ? families : ['arith'],
    max: options.max,
    maxStep: options.max === 100 ? 10 : 100,
    lengths: options.blanks >= 3 ? [8, 8] : options.blanks === 2 ? [7, 8] : [6, 7],
    blanks: [options.blanks, options.blanks],
    types: options.types.length ? options.types : FREE_TYPES,
  };
}

// ─── 出題 ───

/** 自由模式題目的額外資料 */
export interface FreeInfo {
  spec: PatternSpec;
  /** 說說規律：四個選項與正確答案 */
  ruleOptions?: string[];
  ruleAnswer?: string;
  /** 說說規律：每個錯誤選項對應的規律，用來做提示 */
  ruleDistractors?: PatternSpec[];
}

function validBlankSet(blanks: number[], length: number): boolean {
  const set = new Set(blanks);
  if (length - set.size < 3) return false;
  for (let i = 0; i + 2 < length; i++) if (set.has(i) && set.has(i + 1) && set.has(i + 2)) return false;
  for (let i = 0; i + 1 < length; i++) if (!set.has(i) && !set.has(i + 1)) return true;
  return false;
}

function nearMisses(answer: number, max: number, exclude: number[], extra: number[] = []): number[] {
  const out: number[] = [];
  for (const c of [...extra, answer + 1, answer - 1, answer + 2, answer - 2, answer + 10, answer - 10]) {
    if (c === answer || c < 0 || c > max || exclude.includes(c) || out.includes(c)) continue;
    out.push(c);
  }
  for (let k = 3; out.length < 6 && k <= max; k++) {
    for (const c of [answer + k, answer - k]) {
      if (c >= 0 && c <= max && c !== answer && !exclude.includes(c) && !out.includes(c)) out.push(c);
    }
  }
  return out;
}

/**
 * 說說規律的錯誤選項：依正確答案的規律，模仿孩子常見的誤會
 * （只看第一個差、方向弄反、倍數差一點、把兩種規律搞混），而且一定不能符合這串數。
 */
function ruleDistractors(spec: PatternSpec, terms: number[], rng: Rng): PatternSpec[] {
  const [x = 1, y = 1] = spec.params;
  const d0 = terms[1]! - terms[0]!;
  const d1 = terms[2]! - terms[1]!;
  const ratio = terms[0] ? Math.max(2, Math.round(terms[1]! / terms[0]!)) : 2;
  const arith = (d: number): PatternSpec => ({ family: 'arith', params: [d] });
  const growing = (k: number): PatternSpec => ({ family: 'growing', params: [k] });
  const multiply = (r: number): PatternSpec => ({ family: 'multiply', params: [r] });
  const pools: Record<FamilyId, PatternSpec[]> = {
    arith: [arith(x + 1), arith(x - 1), arith(-x), arith(x * 2), growing(1), multiply(2), { family: 'alternate', params: [x, x + 2] }],
    alternate: [arith(d0), arith(d1), arith(d0 + d1), { family: 'alternate', params: [y, x] }, growing(Math.abs(d1 - d0) || 1)],
    growing: [arith(d0), arith(d1), growing(x + 1), growing(Math.max(1, x - 1)), multiply(2), { family: 'fibonacci', params: [] }],
    multiply: [arith(d0), multiply(x + 1), growing(Math.abs(d1 - d0) || 1), { family: 'affine', params: [x, 1] }, { family: 'square', params: [] }],
    halve: [arith(d0), multiply(2), growing(Math.abs(d1 - d0) || 1), { family: 'fibonacci', params: [] }],
    affine: [multiply(x), { family: 'affine', params: [x, -y] }, arith(d0), growing(Math.abs(d1 - d0) || 1), { family: 'fibonacci', params: [] }],
    fibonacci: [arith(d0), growing(1), multiply(ratio), { family: 'alternate', params: [d0, d1] }, { family: 'square', params: [] }],
    interleave: [arith(d0), { family: 'alternate', params: [d0, d1] }, { family: 'interleave', params: [y, x] }, { family: 'interleave', params: [x, -y] }],
    square: [arith(d0), growing(1), multiply(ratio), { family: 'fibonacci', params: [] }],
  };
  // 同一類想不出 3 個時，用其他規律補
  const fallback: PatternSpec[] = [arith(d0 + 1), growing(1), multiply(2), { family: 'halve', params: [] }, { family: 'fibonacci', params: [] }];
  const correct = describeSpec(spec, terms);
  const seen = new Set([correct]);
  const out: PatternSpec[] = [];
  for (const cand of [...shuffle(rng, pools[spec.family]), ...shuffle(rng, fallback)]) {
    if (cand.params.some((p) => p === 0)) continue;
    const text = describeSpec(cand, terms);
    if (seen.has(text) || specFits(cand, terms)) continue;
    seen.add(text);
    out.push(cand);
    if (out.length === 3) break;
  }
  return out;
}

function makeQuestion(
  type: QuestionType,
  spec: PatternSpec,
  terms: number[],
  blanks: number[],
  extra: Partial<Question> = {},
  info: Partial<FreeInfo> = {},
): Question {
  return {
    key: `free:${type}:${spec.family}:${terms.join(',')}:${blanks.join('|')}:${extra.wrong ?? ''}`,
    levelId: 'free',
    mode: 'free',
    type,
    terms,
    blanks,
    answers: blanks.map((b) => terms[b]!),
    step: terms[1]! - terms[0]!,
    choices: [],
    free: { spec, ...info },
    ...extra,
  };
}

function tryQuestion(type: QuestionType, family: FamilyId, rng: Rng, settings: FreeSettings): Question | null {
  const length = randomInt(rng, settings.lengths[0], settings.lengths[1]);
  const generated = randomPattern(family, rng, length, settings.max, settings.maxStep);
  if (!generated) return null;
  const { spec, terms } = generated;
  if (new Set(terms).size !== terms.length && type !== 'fill' && type !== 'next') return null;

  if (type === 'next') {
    const blanks = [length - 1];
    if (!freeUnique(family, terms, blanks)) return null;
    const answer = terms[length - 1]!;
    // 錯誤選項：照「每次多一樣的數」接下去、差 1、差 10……
    const lastDiff = terms[length - 2]! - terms[length - 3]!;
    const wrong = nearMisses(answer, settings.max, terms.slice(0, -1), [terms[length - 2]! + lastDiff]).slice(0, 3);
    if (wrong.length < 3) return null;
    return makeQuestion(type, spec, terms, blanks, { choices: shuffle(rng, [answer, ...wrong]) });
  }

  if (type === 'fill') {
    const count = randomInt(rng, settings.blanks[0], settings.blanks[1]);
    for (let tries = 0; tries < 30; tries++) {
      const blanks = shuffle(rng, terms.map((_, i) => i)).slice(0, count).sort((a, b) => a - b);
      if (!validBlankSet(blanks, length)) continue;
      if (freeUnique(family, terms, blanks)) return makeQuestion(type, spec, terms, blanks);
    }
    return null;
  }

  if (type === 'error') {
    for (let tries = 0; tries < 10; tries++) {
      const at = randomInt(rng, 0, length - 1);
      const correct = terms[at]!;
      const wrong = pick(rng, nearMisses(correct, settings.max, terms).slice(0, 4));
      const shown = [...terms];
      shown[at] = wrong;
      if (freeErrorUnique(family, shown, at, correct)) return makeQuestion(type, spec, terms, [at], { wrong });
    }
    return null;
  }

  if (type === 'order') {
    // 排一排只出一直變大或一直變小的數列，排好的順序才會就是規律
    if (!strictlyMonotonic(terms)) return null;
    let cards = shuffle(rng, terms);
    while (cards.every((c, i) => c === terms[i])) cards = shuffle(rng, terms);
    return makeQuestion(type, spec, terms, terms.map((_, i) => i), { cards });
  }

  // 說說規律：整串數都看得到，從 4 個說明選一個
  const distractors = ruleDistractors(spec, terms, rng);
  if (distractors.length < 3) return null;
  const ruleAnswer = describeSpec(spec, terms);
  const ruleOptions = shuffle(rng, [ruleAnswer, ...distractors.map((s) => describeSpec(s, terms))]);
  return makeQuestion(type, spec, terms, [], {}, { ruleOptions, ruleAnswer, ruleDistractors: distractors });
}

/** 自由模式出一題；題目的答案一定唯一 */
export function generateFreeQuestion(rng: Rng, settings: FreeSettings): Question {
  for (let tries = 0; tries < 400; tries++) {
    const type = pick(rng, settings.types);
    const family = pick(rng, settings.families);
    const q = tryQuestion(type, family, rng, settings);
    if (q) return q;
  }
  // 設定太嚴格時，退回最簡單的等差補空格，保證一定出得了題
  for (;;) {
    const q = tryQuestion('fill', 'arith', rng, { ...settings, blanks: [1, 1], lengths: [6, 6] });
    if (q) return q;
  }
}

// ─── 說明與提示 ───

/** 第 i 個數和前一個（或前兩個）數的關係，例如「12 再多 5 是 17」「24 乘 2 是 48」 */
function forward(spec: PatternSpec, terms: number[], i: number, to: string): string | null {
  const [x = 0, y = 0] = spec.params;
  const prev = terms[i - 1];
  switch (spec.family) {
    case 'arith':
    case 'alternate':
    case 'growing': {
      if (prev === undefined) return null;
      const diff = terms[i]! - prev;
      return diff >= 0 ? `${prev} 再多 ${diff} 是${to}` : `比 ${prev} 少 ${-diff} 是${to}`;
    }
    case 'multiply':
      return prev === undefined ? null : `${prev} 乘 ${x} 是${to}`;
    case 'halve':
      return prev === undefined ? null : `${prev} 的一半是${to}`;
    case 'affine':
      return prev === undefined ? null : `${prev} 乘 ${x} 再${signed('加', y)} 是${to}`;
    case 'fibonacci': {
      const prev2 = terms[i - 2];
      return prev === undefined || prev2 === undefined ? null : `${prev2} 加 ${prev} 是${to}`;
    }
    case 'interleave': {
      const before = terms[i - 2];
      if (before === undefined) return null;
      const diff = terms[i]! - before;
      const pair = `（第 ${i - 1} 個和第 ${i + 1} 個一組）`;
      return diff >= 0 ? `${before} 再多 ${diff} 是${to}${pair}` : `比 ${before} 少 ${-diff} 是${to}${pair}`;
    }
    case 'square': {
      const n = Math.round(Math.sqrt(terms[i]!));
      return `${n}×${n} 是${to}`;
    }
  }
}

/** 第 i 個數從後一個（或後兩個）數往回推，例如「比 50 少 10 是 40」「48 除以 2 是 24」 */
function backward(spec: PatternSpec, terms: number[], i: number, to: string): string | null {
  const [x = 0, y = 0] = spec.params;
  const next = terms[i + 1];
  switch (spec.family) {
    case 'arith':
    case 'alternate':
    case 'growing': {
      if (next === undefined) return null;
      const diff = next - terms[i]!;
      return diff >= 0 ? `比 ${next} 少 ${diff} 是${to}` : `${next} 再多 ${-diff} 是${to}`;
    }
    case 'multiply':
      return next === undefined ? null : `${next} 除以 ${x} 是${to}`;
    case 'halve':
      return next === undefined ? null : `${next} 乘 2 是${to}`;
    case 'affine':
      return next === undefined ? null : `${next} ${y >= 0 ? `減 ${y}` : `加 ${-y}`}，再除以 ${x} 是${to}`;
    case 'fibonacci': {
      const next2 = terms[i + 2];
      return next === undefined || next2 === undefined ? null : `${next2} 減 ${next} 是${to}`;
    }
    case 'interleave': {
      const after = terms[i + 2];
      if (after === undefined) return null;
      const diff = after - terms[i]!;
      const pair = `（第 ${i + 1} 個和第 ${i + 3} 個一組）`;
      return diff >= 0 ? `比 ${after} 少 ${diff} 是${to}${pair}` : `${after} 再多 ${-diff} 是${to}${pair}`;
    }
    case 'square':
      return forward(spec, terms, i, to);
  }
}

/** 前兩個數加起來的數列：只知道前一個和後一個時，「後一個減前一個」 */
function fibMiddle(terms: number[], i: number, to: string): string | null {
  const prev = terms[i - 1];
  const next = terms[i + 1];
  return prev === undefined || next === undefined ? null : `${next} 減 ${prev} 是${to}`;
}

/** 推算第 i 個數需要用到哪些位置 */
function needs(spec: PatternSpec, i: number, dir: 'forward' | 'backward' | 'middle'): number[] {
  switch (spec.family) {
    case 'square':
      return [];
    case 'fibonacci':
      return dir === 'forward' ? [i - 1, i - 2] : dir === 'backward' ? [i + 1, i + 2] : [i - 1, i + 1];
    case 'interleave':
      return dir === 'forward' ? [i - 2] : [i + 2];
    default:
      return dir === 'forward' ? [i - 1] : [i + 1];
  }
}

/**
 * 推算第 i 個數的句子。visible 決定可以用哪些位置（說明用全部，提示只能用看得到的）。
 * 找不到能用的位置時回傳 null。
 */
function relation(spec: PatternSpec, terms: number[], i: number, to: string, visible: (k: number) => boolean): string | null {
  const ok = (positions: number[]) => positions.every((k) => k >= 0 && k < terms.length && visible(k));
  if (spec.family === 'square') return forward(spec, terms, i, to);
  if (ok(needs(spec, i, 'forward'))) return forward(spec, terms, i, to);
  if (ok(needs(spec, i, 'backward'))) return backward(spec, terms, i, to);
  if (spec.family === 'fibonacci' && ok(needs(spec, i, 'middle'))) return fibMiddle(terms, i, to);
  return null;
}

export function explainFree(question: Question): { rule: string; reasons: string[] } {
  const { spec } = question.free!;
  const rule = describeSpec(spec, question.terms);
  if (question.type === 'order' || question.type === 'rule') return { rule, reasons: [] };
  // 依推算的順序說明：每次挑一格「只用看得到的數或已經說明過的數就算得出來」的空格，
  // 避免說明用到後面才算出來的數（例如先寫「18 減 10 是 8」，後面才說明 18 怎麼來）
  const known = new Set(question.terms.map((_, i) => i).filter((i) => !question.blanks.includes(i)));
  const left = [...question.blanks];
  const reasons: string[] = [];
  while (left.length) {
    let k = left.findIndex((b) => relation(spec, question.terms, b, '', (i) => known.has(i)) !== null);
    if (k < 0) k = 0;
    const b = left.splice(k, 1)[0]!;
    const to = ` ${question.terms[b]}`;
    reasons.push(
      relation(spec, question.terms, b, to, (i) => known.has(i)) ??
        relation(spec, question.terms, b, to, (i) => i !== b) ??
        `${question.terms[b]}`,
    );
    known.add(b);
  }
  return { rule, reasons };
}

function relationLabel(spec: PatternSpec, a: number, b: number): string {
  const [x = 0, y = 0] = spec.params;
  switch (spec.family) {
    case 'multiply':
      return `×${x}`;
    case 'halve':
      return '一半';
    case 'affine':
      return `×${x}${y >= 0 ? '+' : '−'}${Math.abs(y)}`;
    default:
      return b - a >= 0 ? `+${b - a}` : `−${a - b}`;
  }
}

/** 完整數列每兩顆之間的關係（例如 ×2、+5、一半），排一排排好後顯示；兩組交錯的數列相鄰兩顆沒有固定關係，不標 */
export function freeSolvedGaps(question: Question): { index: number; label: string }[] {
  const { spec } = question.free!;
  if (spec.family === 'interleave') return [];
  return question.terms.slice(0, -1).map((v, i) => ({ index: i, label: relationLabel(spec, v, question.terms[i + 1]!) }));
}

const FAMILY_INTRO: Record<FamilyId, string> = {
  arith: '看看石頭下面的數字，每兩顆差多少？',
  alternate: '看看石頭下面的數字，每兩顆差多少？差有什麼規律？',
  growing: '看看石頭下面的數字，每兩顆差多少？差有什麼規律？',
  multiply: '看看石頭下面，每一顆是前一顆怎麼變來的？',
  halve: '看看石頭下面，每一顆是前一顆怎麼變來的？',
  affine: '看看石頭下面，每一顆是前一顆怎麼變來的？',
  fibonacci: '看看每一顆和前面兩顆有什麼關係？',
  interleave: '把第 1、3、5…個和第 2、4、6…個分開看',
  square: '看看石頭下面的數字，每兩顆差多少？差有什麼規律？',
};

export function hintFree(question: Question, focus: number): { intro: string; gaps: { index: number; label: string }[]; rule: string; guide: string } {
  const { spec } = question.free!;
  const { terms, blanks, type } = question;
  const rule = describeSpec(spec, terms);

  if (type === 'error') {
    const shown = [...terms];
    shown[blanks[0]!] = question.wrong!;
    // 找錯誤：標出每兩顆實際的差，讓孩子自己比對哪裡和規律不合（兩組交錯的數列相鄰的差沒有意義，不標）
    const gaps =
      spec.family === 'interleave'
        ? []
        : shown.slice(0, -1).map((v, i) => ({ index: i, label: shown[i + 1]! - v >= 0 ? `+${shown[i + 1]! - v}` : `−${v - shown[i + 1]!}` }));
    return { intro: '照著規律一顆一顆檢查，哪一顆對不上？', gaps, rule, guide: `規律是「${rule}」，從第一顆開始一顆一顆檢查。` };
  }
  if (type === 'order') {
    const word = terms[1]! > terms[0]! ? '小' : '大';
    return {
      intro: `最${word}的數放第一顆，再從剩下的卡裡找最${word}的，一顆一顆排`,
      gaps: [],
      rule,
      guide: `第一顆是 ${terms[0]}，下一顆是多少？`,
    };
  }
  if (type === 'rule') {
    // 第 1 層只標實際的差（例如 +5 +10 +20），不能標 ×2，否則等於直接說出答案「每次乘 2」
    const gaps = terms
      .slice(0, -1)
      .map((v, i) => ({ index: i, label: terms[i + 1]! - v >= 0 ? `+${terms[i + 1]! - v}` : `−${v - terms[i + 1]!}` }));
    const wrong = (question.free!.ruleDistractors ?? []).map((s) => mismatchHint(s, terms)).find(Boolean);
    return {
      intro: '先看看每兩顆差多少，差有什麼規律？',
      gaps,
      rule: '一個一個選項試試看：照著它從第一個數算，能不能算出這串數？',
      guide: wrong ?? '一個一個選項試試看：照著它從第一個數算，能不能算出這串數？',
    };
  }

  const visible = (k: number) => !blanks.includes(k);
  const gaps =
    spec.family === 'interleave'
      ? []
      : terms
          .slice(0, -1)
          .map((v, i) => ({ i, v }))
          .filter(({ i }) => visible(i) && visible(i + 1))
          .map(({ i, v }) => ({ index: i, label: relationLabel(spec, v, terms[i + 1]!) }));

  let guide = relation(spec, terms, focus, '多少', visible);
  if (guide) guide = `${guide}？`;
  else {
    // 這一格旁邊沒有夠用的數：引導先算另一個空格
    const other = blanks.find((b) => b !== focus && relation(spec, terms, b, '多少', visible));
    guide = other !== undefined ? `先算另一個空格：${relation(spec, terms, other, '多少', visible)}？` : `照著「${rule}」想想看`;
  }
  return { intro: FAMILY_INTRO[spec.family], gaps, rule, guide };
}
