<script setup lang="ts">
/** 自由模式：一直出題，記錄連續答對幾題和最高紀錄 */
import { computed, ref } from 'vue';
import {
  FREE_PRESETS,
  createRng,
  customSettings,
  generateFreeQuestion,
  type Question,
  type QuestionResult,
} from '@kidstudy/game-core';
import QuestionCard from './QuestionCard.vue';
import { progress, recordFreeStreak, settings, type FreeKey } from '../store';

const props = defineProps<{ freeKey: FreeKey }>();
const emit = defineEmits<{ exit: [] }>();

const freeSettings = computed(() =>
  props.freeKey === 'custom' ? customSettings(settings.freeCustom) : FREE_PRESETS[props.freeKey].settings,
);
const name = computed(() => (props.freeKey === 'custom' ? '自訂' : FREE_PRESETS[props.freeKey].name));
const maxDigits = computed(() => String(freeSettings.value.max).length);

const rng = createRng(Date.now());
const question = ref<Question>(generateFreeQuestion(rng, freeSettings.value));
/** 第幾題，換題時讓 QuestionCard 重新建立 */
const count = ref(1);
/** 連續答對幾題（第二次才答對也算） */
const streak = ref(0);
/** 這次是不是打破了最高紀錄 */
const newBest = ref(false);
const best = computed(() => progress.freeBest[props.freeKey] ?? 0);

function onResult(result: QuestionResult) {
  if (result.correct) {
    streak.value++;
    if (recordFreeStreak(props.freeKey, streak.value)) newBest.value = true;
  } else {
    streak.value = 0;
  }
}

function next() {
  question.value = generateFreeQuestion(rng, freeSettings.value);
  count.value++;
}
</script>

<template>
  <header class="bar">
    <button type="button" class="btn secondary back" @click="emit('exit')">← 自由模式</button>
    <h1>
      自由模式
      <span class="badge">{{ name }}</span>
    </h1>
    <div class="score" aria-live="polite">
      <span class="streak">連續答對 <strong>{{ streak }}</strong> 題</span>
      <span class="best" :class="{ record: newBest }">{{ newBest ? '新紀錄！' : '最高' }} {{ best }} 題</span>
    </div>
  </header>

  <QuestionCard
    :key="count"
    :question="question"
    :max-digits="maxDigits"
    next-label="下一題"
    @result="onResult"
    @next="next"
  />
</template>

<style scoped>
.bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 14px;
}

.back {
  min-height: 44px;
  padding: 6px 16px;
  font-size: 0.95rem;
}

h1 {
  flex: 1;
  margin: 0;
  font-size: 1.3rem;
  color: var(--primary-dark);
}

.badge {
  display: inline-block;
  margin-left: 4px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 0.85rem;
  vertical-align: middle;
  background: var(--primary-soft);
  color: var(--primary-dark);
}

.score {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1.3;
}

.streak strong {
  font-size: 1.4rem;
  color: var(--primary-dark);
}

.best {
  font-size: 0.85rem;
  color: var(--text-soft);
}

.best.record {
  padding: 0 8px;
  border-radius: 999px;
  background: var(--accent);
  color: var(--text);
  font-weight: 800;
}
</style>
