<script setup lang="ts">
const props = defineProps<{
  choices: number[];
  answer: number;
  picked: number | null;
  status: 'answering' | 'correct' | 'wrong';
}>();
const emit = defineEmits<{ choose: [value: number] }>();

function stateOf(choice: number): string {
  if (props.status === 'answering') return '';
  if (choice === props.answer) return 'correct';
  return choice === props.picked ? 'wrong' : 'dim';
}
</script>

<template>
  <div class="choices" :class="{ four: choices.length === 4 }" role="group" aria-label="選項">
    <button
      v-for="choice in choices"
      :key="choice"
      type="button"
      class="choice"
      :class="stateOf(choice)"
      :disabled="status !== 'answering'"
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
</style>
