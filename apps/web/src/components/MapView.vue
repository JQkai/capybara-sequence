<script setup lang="ts">
import { computed } from 'vue';
import { LEVELS, isUnlocked, type Level } from '@kidstudy/game-core';
import Capybara from './Capybara.vue';
import StarRow from './StarRow.vue';
import { progress, settings, type TermKey } from '../store';
import { speechSupported } from '../speech';

defineEmits<{ select: [level: Level] }>();

const TERMS: { key: TermKey; short: string; long: string }[] = [
  { key: '1-1', short: '一上', long: '一年級上學期' },
  { key: '1-2', short: '一下', long: '一年級下學期' },
  { key: '2-1', short: '二上', long: '二年級上學期' },
  { key: '2-2', short: '二下', long: '二年級下學期' },
];

/** 地圖上每一站的垂直間距（px）與左右位置（%），排成彎彎的小路 */
const ROW = 118;
// 第一站上方留位置給站在石頭上的卡皮巴拉
const TOP = 84;
const X_PATTERN = [30, 70];

const levels = computed(() =>
  LEVELS.filter((level) => `${level.grade}-${level.semester}` === settings.term),
);

const stops = computed(() =>
  levels.value.map((level, i) => ({
    level,
    number: i + 1,
    x: X_PATTERN[i % X_PATTERN.length]!,
    y: TOP + i * ROW,
    stars: progress.bestStars[level.id] ?? 0,
    played: level.id in progress.bestStars,
    unlocked: isUnlocked(level, progress.bestStars),
  })),
);

/** 卡皮巴拉站在第一個還沒拿到星星的關卡上 */
const currentId = computed(() => stops.value.find((s) => s.unlocked && s.stars === 0)?.level.id);

const goal = computed(() => {
  const n = stops.value.length;
  return { x: X_PATTERN[n % X_PATTERN.length]!, y: TOP + n * ROW, done: stops.value.every((s) => s.stars > 0) };
});

const height = computed(() => goal.value.y + 70);

/** 連接各站的虛線小路，用平滑的曲線 */
const pathD = computed(() => {
  const points = [...stops.value.map((s) => [s.x, s.y]), [goal.value.x, goal.value.y]] as [number, number][];
  return points
    .map(([x, y], i) => {
      if (i === 0) return `M ${x} ${y}`;
      const [px, py] = points[i - 1]!;
      const mid = (py + y) / 2;
      return `C ${px} ${mid} ${x} ${mid} ${x} ${y}`;
    })
    .join(' ');
});

/** 標籤那一側還剩地圖寬度的幾成：標籤在右邊就是右側的空間，在左邊就是左側的空間 */
function roomFor(x: number): number {
  return (x > 50 ? x : 100 - x) / 100;
}

const termLabel = computed(() => TERMS.find((t) => t.key === settings.term)?.long ?? '');
const termStars = computed(() => stops.value.reduce((sum, s) => sum + s.stars, 0));
</script>

<template>
  <header class="hero">
    <Capybara :size="84" class="mascot" />
    <h1>數列卡皮巴拉</h1>
    <p>找出數字的規律，陪卡皮巴拉踩著石頭去泡溫泉！</p>
    <div class="toggles">
      <label class="toggle">
        <input v-model="settings.sound" type="checkbox" />
        <span>音效</span>
      </label>
      <label v-if="speechSupported" class="toggle">
        <input v-model="settings.autoRead" type="checkbox" />
        <span>自動唸題目</span>
      </label>
    </div>
  </header>

  <nav class="tabs" role="tablist" aria-label="選擇學期">
    <button
      v-for="term in TERMS"
      :key="term.key"
      type="button"
      role="tab"
      class="tab"
      :aria-selected="settings.term === term.key"
      :aria-label="term.long"
      @click="settings.term = term.key"
    >
      {{ term.short }}
    </button>
  </nav>

  <p class="summary">
    {{ termLabel }}・已經拿到
    <strong>{{ termStars }}</strong> / {{ stops.length * 3 }} 顆星
  </p>

  <section class="map" :style="{ height: `${height}px` }" aria-label="關卡地圖">
    <svg class="trail" :viewBox="`0 0 100 ${height}`" preserveAspectRatio="none" aria-hidden="true">
      <path :d="pathD" vector-effect="non-scaling-stroke" />
    </svg>

    <div
      v-for="stop in stops"
      :key="stop.level.id"
      class="stop"
      :class="{ right: stop.x > 50 }"
      :style="{ left: `${stop.x}%`, top: `${stop.y}px`, '--room': roomFor(stop.x) }"
    >
      <Capybara v-if="stop.level.id === currentId" :size="44" class="here" />
      <button
        type="button"
        class="stone"
        :class="{ locked: !stop.unlocked, cleared: stop.stars > 0 }"
        :disabled="!stop.unlocked"
        :aria-label="`第 ${stop.number} 關：${stop.level.title}${stop.unlocked ? '' : '（還沒解鎖）'}`"
        @click="$emit('select', stop.level)"
      >
        <span v-if="stop.unlocked">{{ stop.number }}</span>
        <span v-else aria-hidden="true">🔒</span>
      </button>
      <div class="label">
        <span class="title">{{ stop.level.title }}</span>
        <StarRow v-if="stop.played" :count="stop.stars" />
        <span v-else class="desc">{{ stop.unlocked ? stop.level.description : '前一關拿到星星就能玩' }}</span>
      </div>
    </div>

    <div
      class="stop goal"
      :class="{ right: goal.x > 50 }"
      :style="{ left: `${goal.x}%`, top: `${goal.y}px`, '--room': roomFor(goal.x) }"
    >
      <div class="spring" aria-hidden="true">
        <Capybara v-if="goal.done" :size="40" class="bathing" />
        <span v-else>♨️</span>
      </div>
      <div class="label">
        <span class="title">溫泉</span>
        <span class="desc">{{ goal.done ? '每一關都拿到星星，泡溫泉囉！' : '每一關都拿到星星就能泡溫泉' }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.hero {
  text-align: center;
  padding: 8px 0 4px;
}

.mascot {
  margin: 0 auto;
}

h1 {
  margin: 6px 0 2px;
  font-size: 1.9rem;
  color: var(--primary-dark);
}

.hero p {
  margin: 0;
  color: var(--text-soft);
}

.toggles {
  display: flex;
  justify-content: center;
  gap: 18px;
  margin-top: 10px;
  font-size: 0.95rem;
  color: var(--text-soft);
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.toggle input {
  width: 20px;
  height: 20px;
  accent-color: var(--primary);
}

.tabs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin-top: 18px;
  padding: 5px;
  background: var(--primary-soft);
  border-radius: 999px;
}

.tab {
  min-height: 44px;
  border: none;
  border-radius: 999px;
  background: transparent;
  font-weight: 700;
  color: var(--primary-dark);
}

.tab[aria-selected='true'] {
  background: var(--primary);
  color: #fff;
}

.summary {
  margin: 12px 0 0;
  text-align: center;
  color: var(--text-soft);
  font-size: 0.95rem;
}

.summary strong {
  color: var(--primary-dark);
}

.map {
  position: relative;
  margin-top: 12px;
}

.trail {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.trail path {
  fill: none;
  stroke: var(--stone-edge);
  stroke-width: 5;
  stroke-dasharray: 2 12;
  stroke-linecap: round;
}

/* 每一站的中心點在 (left, top)，標籤放在石頭旁邊 */
.stop {
  position: absolute;
  transform: translate(-36px, -36px);
  display: flex;
  align-items: center;
  gap: 10px;
}

.stop.right {
  flex-direction: row-reverse;
  transform: translate(calc(-100% + 36px), -36px);
}

.stop.right .label {
  text-align: right;
  align-items: flex-end;
}

.stone {
  position: relative;
  display: grid;
  place-items: center;
  flex: none;
  width: 72px;
  height: 72px;
  border-radius: 50% 46% 48% 44% / 46% 50% 44% 50%;
  background: var(--stone);
  border: 3px solid var(--stone-edge);
  box-shadow: 0 5px 0 var(--stone-edge);
  font-size: 1.6rem;
  font-weight: 800;
  transition: transform 0.08s;
}

.stone:active:not(:disabled) {
  transform: translateY(3px);
  box-shadow: 0 2px 0 var(--stone-edge);
}

.stone.cleared {
  background: var(--accent-soft);
  border-color: var(--accent);
  box-shadow: 0 5px 0 #d9a441;
}

.stone.locked {
  /* 用淡色而不是透明度，避免底下的小路透出來 */
  background: #f3f0eb;
  border-color: #d8cfc3;
  box-shadow: 0 5px 0 #d8cfc3;
  font-size: 1.3rem;
}

.stone.locked span {
  opacity: 0.6;
}

.here {
  position: absolute;
  left: 14px;
  top: -40px;
  z-index: 1;
  pointer-events: none;
}

.stop.right .here {
  left: auto;
  right: 14px;
}

.label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: max-content;
  /* 地圖寬度（手機上是畫面寬度扣掉左右 16px）× 這一側的比例，再扣掉半顆石頭和間距 */
  max-width: min(180px, calc(min(100vw - 32px, 728px) * var(--room) - 50px));
}

.title {
  font-weight: 800;
  color: var(--primary-dark);
  line-height: 1.3;
}

.desc {
  font-size: 0.85rem;
  color: var(--text-soft);
  line-height: 1.35;
}

.spring {
  display: grid;
  place-items: center;
  flex: none;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: #d8f0ee;
  border: 3px solid #8cc9c3;
  font-size: 2.2rem;
}
</style>
