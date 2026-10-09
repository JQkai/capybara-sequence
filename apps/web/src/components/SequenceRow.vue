<script setup lang="ts">
import { computed } from 'vue';
import type { Gap } from '@kidstudy/game-core';
import Capybara from './Capybara.vue';

const props = withDefaults(
  defineProps<{
    terms: number[];
    blankIndex: number;
    /** 空格裡顯示的內容：孩子輸入的數字，或還沒作答時的「?」 */
    blankText: string;
    /** retry＝答錯一次、正在再試 */
    status: 'answering' | 'retry' | 'correct' | 'wrong';
    /** 第 1 層提示：標在相鄰兩個數之間的差，例如「+5」 */
    gaps?: Gap[];
  }>(),
  { gaps: () => [] },
);

const gapAt = computed(() => new Map(props.gaps.map((g) => [g.index, g.label])));
</script>

<template>
  <ol class="row" aria-label="數列">
    <li
      v-for="(term, i) in terms"
      :key="i"
      class="pad"
      :class="i === blankIndex ? ['blank', status] : []"
      :aria-label="i === blankIndex ? `空格：${blankText === '?' ? '還沒填' : blankText}` : String(term)"
    >
      <Capybara v-if="i === blankIndex" :size="46" class="mascot" />
      <span class="num">{{ i === blankIndex ? blankText : term }}</span>
      <span v-if="gapAt.has(i)" class="gap" :aria-label="`和下一個數差 ${gapAt.get(i)}`">{{ gapAt.get(i) }}</span>
    </li>
  </ol>
</template>

<style scoped>
/* 數列一定排成一行，手機上縮小石頭而不是換行 */
.row {
  display: flex;
  justify-content: center;
  --gap: clamp(5px, 1.5vw, 10px);
  gap: var(--gap);
  margin: 0;
  /* 下方留位置給提示的「+5」，出現提示時版面才不會跳動 */
  padding: 50px 0 36px;
  list-style: none;
}

/* 石頭 */
.pad {
  position: relative;
  display: grid;
  place-items: center;
  flex: none;
  width: clamp(52px, calc((100vw - 90px) / 5), 96px);
  height: clamp(52px, calc((100vw - 90px) / 5), 96px);
  /* 不完全圓的石頭形狀 */
  border-radius: 50% 46% 48% 44% / 46% 50% 44% 50%;
  background: var(--stone);
  border: 3px solid var(--stone-edge);
  box-shadow: 0 4px 0 var(--stone-edge);
  font-size: clamp(1rem, 4.6vw, 2rem);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.blank {
  background: var(--accent-soft);
  border: 3px dashed var(--accent);
  box-shadow: none;
}

.blank.correct {
  background: var(--correct-soft);
  border: 3px solid var(--correct);
  animation: pop 0.35s ease-out;
}

.blank.retry {
  background: var(--wrong-soft);
  border: 3px dashed var(--wrong);
  animation: shake 0.35s;
}

.blank.wrong {
  background: var(--wrong-soft);
  border: 3px solid var(--wrong);
  animation: shake 0.35s;
}

.mascot {
  position: absolute;
  top: -42px;
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
  animation: pop 0.3s ease-out;
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
