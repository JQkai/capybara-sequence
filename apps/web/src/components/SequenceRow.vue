<script setup lang="ts">
import { computed } from 'vue';
import type { Gap } from '@kidstudy/game-core';
import Capybara from './Capybara.vue';

/**
 * 空格的狀態：
 * answering＝還沒填；active＝正在填；retry＝答錯、要再試；correct＝答對；
 * wrong＝答錯（顯示孩子填的數）；reveal＝最後答錯，顯示正確答案
 */
export type BlankStatus = 'answering' | 'active' | 'retry' | 'correct' | 'wrong' | 'reveal';

const props = withDefaults(
  defineProps<{
    terms: number[];
    blanks: number[];
    /** 每個空格顯示的內容，key 是空格位置 */
    blankTexts: Record<number, string>;
    blankStatus: Record<number, BlankStatus>;
    /** 卡皮巴拉站在哪一格 */
    mascotAt: number;
    /** 第 1 層提示：標在相鄰兩個數之間的差，例如「+5」 */
    gaps?: Gap[];
    /** 可以點空格選擇要填哪一格（多個空格時） */
    selectable?: boolean;
  }>(),
  { gaps: () => [], selectable: false },
);

const emit = defineEmits<{ select: [position: number] }>();

const gapAt = computed(() => new Map(props.gaps.map((g) => [g.index, g.label])));

/** 手機上超過 5 個數就排成兩排，每排一半 */
const half = computed(() => Math.ceil(props.terms.length / 2));

/** 字的大小依最長的數決定，整排一致 */
const fontScale = computed(() => {
  const digits = Math.max(...props.terms.map((t) => String(t).length));
  return digits <= 2 ? 0.42 : digits === 3 ? 0.34 : 0.27;
});

function isBlank(i: number) {
  return props.blanks.includes(i);
}

function canSelect(i: number) {
  return props.selectable && isBlank(i) && ['answering', 'active', 'retry'].includes(props.blankStatus[i] ?? '');
}

function label(i: number): string {
  if (!isBlank(i)) return String(props.terms[i]);
  const text = props.blankTexts[i] ?? '?';
  return `空格：${text === '?' ? '還沒填' : text}`;
}
</script>

<template>
  <ol
    class="row"
    :class="{ long: terms.length > 5 }"
    :style="{ '--n': terms.length, '--half': half, '--fs': fontScale }"
    aria-label="數列"
  >
    <li
      v-for="(term, i) in terms"
      :key="i"
      class="pad"
      :class="isBlank(i) ? ['blank', blankStatus[i] ?? 'answering', { selectable: canSelect(i) }] : []"
      :role="canSelect(i) ? 'button' : undefined"
      :tabindex="canSelect(i) ? 0 : undefined"
      :aria-label="label(i)"
      :aria-pressed="canSelect(i) ? blankStatus[i] === 'active' : undefined"
      @click="canSelect(i) && emit('select', i)"
      @keydown.enter.space.prevent="canSelect(i) && emit('select', i)"
    >
      <Capybara v-if="i === mascotAt" :size="46" class="mascot" />
      <span class="num">{{ isBlank(i) ? (blankTexts[i] ?? '?') : term }}</span>
      <span
        v-if="gapAt.has(i)"
        class="gap"
        :class="{ break: (i + 1) % half === 0 }"
        :aria-label="`和下一個數差 ${gapAt.get(i)}`"
      >
        {{ gapAt.get(i) }}
      </span>
    </li>
  </ol>
</template>

<style scoped>
/*
 * 數列排成一行，石頭大小依數量自動縮放；
 * 手機上超過 5 個數改排兩排，石頭才不會小到看不清楚。
 */
.row {
  --gap: clamp(5px, 1.5vw, 10px);
  --cols: var(--n);
  --pad: min(96px, calc((min(100vw, 760px) - 64px - (var(--cols) - 1) * var(--gap)) / var(--cols)));
  display: grid;
  grid-template-columns: repeat(var(--cols), var(--pad));
  justify-content: center;
  column-gap: var(--gap);
  /* 兩排時，上排下方的「+5」和下排頭上的卡皮巴拉都要有位置 */
  row-gap: 80px;
  margin: 0;
  /* 下方留位置給提示的「+5」，出現提示時版面才不會跳動 */
  padding: 50px 0 36px;
  list-style: none;
}

@media (max-width: 600px) {
  .row.long {
    --cols: var(--half);
  }

  /* 換排的地方不標差，否則會跑到畫面外 */
  .row.long .gap.break {
    display: none;
  }
}

/* 石頭 */
.pad {
  position: relative;
  display: grid;
  place-items: center;
  width: var(--pad);
  height: var(--pad);
  /* 不完全圓的石頭形狀 */
  border-radius: 50% 46% 48% 44% / 46% 50% 44% 50%;
  background: var(--stone);
  border: 3px solid var(--stone-edge);
  box-shadow: 0 4px 0 var(--stone-edge);
  font-size: min(2rem, calc(var(--pad) * var(--fs)));
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.blank {
  background: var(--accent-soft);
  border: 3px dashed var(--accent);
  box-shadow: none;
}

.blank.selectable {
  cursor: pointer;
}

.blank.active {
  border: 4px solid var(--accent);
  box-shadow: 0 0 0 4px rgba(244, 166, 42, 0.3);
}

.blank.retry {
  background: var(--wrong-soft);
  border: 3px dashed var(--wrong);
  animation: shake 0.35s;
}

.blank.correct {
  background: var(--correct-soft);
  border: 3px solid var(--correct);
  animation: pop 0.35s ease-out;
}

.blank.wrong {
  background: var(--wrong-soft);
  border: 3px solid var(--wrong);
  animation: shake 0.35s;
}

/* 最後還是答錯：空格裡顯示正確答案 */
.blank.reveal {
  background: var(--surface);
  border: 3px solid var(--wrong);
  color: var(--wrong);
}

.mascot {
  position: absolute;
  top: -42px;
  z-index: 1;
  pointer-events: none;
}

/* 標在這顆石頭和右邊那顆中間的下方 */
.gap {
  position: absolute;
  top: calc(100% + 10px);
  left: calc(100% + var(--gap) / 2);
  transform: translateX(-50%);
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  font-size: 0.85rem;
  font-weight: 800;
  white-space: nowrap;
  animation: gap-pop 0.3s ease-out;
}

/* 要保留置中用的 translateX，不能共用 pop */
@keyframes gap-pop {
  0% {
    transform: translateX(-50%) scale(0.6);
  }
  60% {
    transform: translateX(-50%) scale(1.15);
  }
  100% {
    transform: translateX(-50%) scale(1);
  }
}

@keyframes pop {
  50% {
    transform: scale(1.15);
  }
}

@keyframes shake {
  25% {
    transform: translateX(-6px);
  }
  75% {
    transform: translateX(6px);
  }
}
</style>
