<script setup lang="ts" generic="T extends number | string">
import { computed } from 'vue';

const props = defineProps<{
  /** 選項：數（選下一個數）或文字（說說規律） */
  choices: T[];
  answer: T;
  picked: T | null;
  status: 'answering' | 'correct' | 'wrong';
  /** 已經選錯的選項：再試一次時不能再選 */
  eliminated: T[];
}>();
const emit = defineEmits<{ choose: [value: T] }>();

/** 文字選項比較長，一行一個 */
const text = computed(() => props.choices.some((c) => typeof c === 'string'));

function stateOf(choice: T): string {
  if (props.status === 'answering') return props.eliminated.includes(choice) ? 'crossed' : '';
  if (choice === props.answer) return 'correct';
  return choice === props.picked ? 'wrong' : 'dim';
}
</script>

<template>
  <div class="choices" :class="{ four: choices.length === 4, text }" role="group" aria-label="選項">
    <button
      v-for="choice in choices"
      :key="choice"
      type="button"
      class="choice"
      :class="stateOf(choice)"
      :disabled="status !== 'answering' || eliminated.includes(choice)"
      @click="emit('choose', choice)"
    >
      {{ choice }}
    </button>
  </div>
</template>

<style scoped>
.choices {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(84px, 130px);
  justify-content: center;
  gap: 14px;
}

/* 手機上 4 個選項排成 2 × 2，不要 3 + 1 */
@media (max-width: 480px) {
  .choices.four {
    grid-auto-flow: row;
    grid-template-columns: repeat(2, minmax(84px, 130px));
  }
}

/* 說說規律的文字選項：一行一個，寬度撐滿 */
.choices.text,
.choices.text.four {
  grid-auto-flow: row;
  grid-template-columns: minmax(0, 520px);
  gap: 10px;
}

.choice {
  min-height: 72px;
  padding: 8px 18px;
  border: 3px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  font-size: 1.9rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  box-shadow: var(--shadow);
}

.text .choice {
  min-height: 56px;
  font-size: 1.1rem;
  font-weight: 700;
  text-align: left;
}

.choice:active:not(:disabled) {
  transform: translateY(2px);
  box-shadow: none;
}

.correct {
  border-color: var(--correct);
  background: var(--correct-soft);
}

.wrong {
  border-color: var(--wrong);
  background: var(--wrong-soft);
}

.dim {
  opacity: 0.45;
}

.crossed {
  opacity: 0.4;
  text-decoration: line-through;
  text-decoration-thickness: 3px;
  border-style: dashed;
}
</style>
