<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import {
  LEVELS,
  MODES,
  MODE_NAMES,
  PRACTICE_NAMES,
  createRng,
  generateRound,
  levelRange,
  questionPoints,
  starsFor,
  type Level,
  type Mode,
  type Practice,
  type Question,
  type QuestionResult,
} from '@kidstudy/game-core';
import QuestionCard from './QuestionCard.vue';
import Capybara from './Capybara.vue';
import StarRow from './StarRow.vue';
import { recordStars } from '../store';
import { speak, stopSpeaking } from '../speech';
import { playStars } from '../sound';

const ROUND_SIZE = 5;

const props = defineProps<{ level: Level; mode: Mode; practice: Practice }>();
const emit = defineEmits<{ exit: []; play: [level: Level, mode: Mode] }>();

const questions = ref<Question[]>([]);
const index = ref(0);
const results = ref<QuestionResult[]>([]);
const finished = ref(false);
const stars = ref(0);
const newBest = ref(false);
/** 每次「再玩一次」加 1，讓同一題號的 QuestionCard 也重新建立 */
const round = ref(0);

/** 輸入框最多幾位數：依關卡最大的數決定，例如 1000 以內是 4 位 */
const maxDigits = String(levelRange(props.level, props.mode).max).length;

const question = computed(() => questions.value[index.value]!);
const isLast = computed(() => index.value === questions.value.length - 1);
const harderMode = computed(() => MODES[MODES.indexOf(props.mode) + 1]);

function start() {
  questions.value = generateRound(props.level, createRng(Date.now()), {
    count: ROUND_SIZE,
    mode: props.mode,
    practice: props.practice,
  });
  index.value = 0;
  results.value = [];
  finished.value = false;
  round.value++;
}

function next() {
  if (isLast.value) finish();
  else index.value++;
}

function finish() {
  finished.value = true;
  stars.value = starsFor(results.value);
  // 只練一種題型時不記錄星星，避免挑最簡單的題型拿星星
  newBest.value = props.practice === 'mix' && recordStars(props.level.id, props.mode, stars.value);
  playStars(stars.value);
  speak(`拿到 ${stars.value} 顆星。${resultMessage.value}`);
}

/** 同一學期、同一難度的下一關 */
const nextLevel = computed(() => {
  const term = LEVELS.filter((l) => l.grade === props.level.grade && l.semester === props.level.semester);
  return term[term.findIndex((l) => l.id === props.level.id) + 1];
});

const soloCount = computed(() => results.value.filter((r) => questionPoints(r) === 2).length);
const helpedCount = computed(() => results.value.filter((r) => questionPoints(r) === 1).length);

const resultMessage = computed(() => {
  if (stars.value === 3) return '太厲害了！';
  if (stars.value === 2) return '做得很好！再挑戰看看能不能拿到 3 顆星。';
  if (stars.value === 1) return '不錯喔！自己想出來的題目越多，星星就越多。';
  return '多練習幾次，會越來越厲害！';
});

start();
onBeforeUnmount(stopSpeaking);
</script>

<template>
  <header class="bar">
    <button type="button" class="btn secondary back" @click="emit('exit')">← 地圖</button>
    <h1>
      {{ level.title }}
      <span class="mode" :class="mode">{{ MODE_NAMES[mode] }}</span>
      <span v-if="practice !== 'mix'" class="mode practice">{{ PRACTICE_NAMES[practice] }}</span>
    </h1>
    <ol class="progress" :aria-label="`第 ${index + 1} 題，共 ${questions.length} 題`">
      <li
        v-for="(_, i) in questions"
        :key="i"
        :class="{
          solo: results[i] && questionPoints(results[i]) === 2,
          helped: results[i] && questionPoints(results[i]) === 1,
          missed: results[i] && !results[i].correct,
          current: i === index && !finished,
        }"
      />
    </ol>
  </header>

  <section v-if="finished" class="result">
    <Capybara :size="96" class="mascot" />
    <StarRow :count="stars" :size="52" animate class="big-stars" />
    <p v-if="newBest" class="new-best">新紀錄！</p>
    <p class="message">{{ resultMessage }}</p>
    <p class="detail">
      自己答對 {{ soloCount }} 題・有幫忙才答對 {{ helpedCount }} 題（共 {{ ROUND_SIZE }} 題）
    </p>
    <p v-if="practice !== 'mix'" class="detail">只練「{{ PRACTICE_NAMES[practice] }}」時，星星不會記到地圖上</p>
    <div class="actions">
      <button v-if="nextLevel" type="button" class="btn" @click="emit('play', nextLevel, mode)">
        下一關：{{ nextLevel.title }} →
      </button>
      <button
        v-if="harderMode"
        type="button"
        class="btn"
        :class="{ secondary: nextLevel }"
        @click="emit('play', level, harderMode)"
      >
        挑戰{{ MODE_NAMES[harderMode] }}版 →
      </button>
      <button type="button" class="btn secondary" @click="start">再玩一次</button>
      <button type="button" class="btn secondary" @click="emit('exit')">回地圖</button>
    </div>
  </section>

  <QuestionCard
    v-else
    :key="`${round}-${index}`"
    :question="question"
    :max-digits="maxDigits"
    :next-label="isLast ? '看結果' : '下一題'"
    @result="results.push($event)"
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
.mode {
  display: inline-block;
  margin-left: 4px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 0.85rem;
  vertical-align: middle;
  color: #fff;
  background: var(--correct);
}
.mode.hard {
  background: var(--accent);
  color: var(--text);
}
.mode.genius {
  background: var(--genius);
}
.mode.practice {
  background: var(--primary-soft);
  color: var(--primary-dark);
}
.progress {
  display: flex;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.progress li {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--border);
}
.progress li.current {
  background: var(--primary);
}
.progress li.solo {
  background: var(--correct);
}
.progress li.helped {
  background: var(--accent);
}
.progress li.missed {
  background: var(--wrong);
}
.result {
  margin-top: 32px;
  text-align: center;
}
.mascot {
  margin: 0 auto;
}
.big-stars {
  margin-top: 12px;
}
.new-best {
  display: table;
  margin: 10px auto 0;
  padding: 2px 14px;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  font-weight: 800;
}
.message {
  margin: 12px 0 4px;
  font-size: 1.3rem;
  font-weight: 800;
}
.detail {
  margin: 0;
  color: var(--text-soft);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  margin-top: 22px;
}
</style>
