<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  HINT_LEVELS,
  LEVELS,
  MAX_ATTEMPTS,
  checkAnswer,
  createRng,
  explain,
  generateRound,
  hintFor,
  isUnlocked,
  levelRange,
  questionPoints,
  starsFor,
  type Level,
  type Question,
  type QuestionResult,
} from '@kidstudy/game-core';
import SequenceRow from './SequenceRow.vue';
import NumberPad from './NumberPad.vue';
import ChoiceButtons from './ChoiceButtons.vue';
import Capybara from './Capybara.vue';
import StarRow from './StarRow.vue';
import { progress, recordStars, settings } from '../store';
import { speak, speechSupported, stopSpeaking } from '../speech';
import { playCorrect, playStars, playWrong } from '../sound';

const ROUND_SIZE = 5;

const props = defineProps<{ level: Level }>();
const emit = defineEmits<{ exit: []; play: [level: Level] }>();

const questions = ref<Question[]>([]);
const index = ref(0);
const input = ref('');
const picked = ref<number | null>(null);
const status = ref<'answering' | 'correct' | 'wrong'>('answering');
/** 這題已經送出幾次答案 */
const tries = ref(0);
/** 這題打開到第幾層提示（0＝沒用提示） */
const hintLevel = ref(0);
/** 選擇題選錯的選項，再試一次時不能再選 */
const eliminated = ref<number[]>([]);
const results = ref<QuestionResult[]>([]);
const finished = ref(false);
const stars = ref(0);
const newBest = ref(false);

/** 輸入框最多幾位數：依關卡最大的數決定，例如 1000 以內是 4 位 */
const maxDigits = String(levelRange(props.level).max).length;

const question = computed(() => questions.value[index.value]!);
const explanation = computed(() => explain(question.value));
const hint = computed(() => hintFor(question.value));
const isLast = computed(() => index.value === questions.value.length - 1);
const retrying = computed(() => status.value === 'answering' && tries.value > 0);
const prompt = computed(() => (question.value.type === 'next' ? '下一顆石頭上是哪個數？' : '空格裡要填多少？'));
const blankText = computed(() => {
  if (question.value.type === 'next') return status.value === 'answering' ? '?' : String(picked.value);
  return input.value || '?';
});

const HINT_INTRO = '看看石頭下面的數字，每兩顆差多少？';

function hintSpeech(level: number): string {
  if (level === 1) return HINT_INTRO;
  if (level === 2) return `規律是${hint.value.rule}。`;
  return hint.value.guide;
}

function questionSpeech(): string {
  const q = question.value;
  const row = q.terms.map((t, i) => (i === q.blankIndex ? '空格' : String(t))).join('，');
  const options = q.type === 'next' ? `是 ${q.choices.join('、')} 裡的哪一個？` : '';
  return `${row}。${prompt.value}${options}`;
}

function start() {
  questions.value = generateRound(props.level, createRng(Date.now()), ROUND_SIZE);
  index.value = 0;
  results.value = [];
  finished.value = false;
  resetQuestion();
}

function resetQuestion() {
  input.value = '';
  picked.value = null;
  status.value = 'answering';
  tries.value = 0;
  hintLevel.value = 0;
  eliminated.value = [];
}

function submit(value: number | string) {
  if (status.value !== 'answering') return;
  tries.value++;
  const { rule, reason, times } = explanation.value;
  const timesText = times ? `${times}。` : '';

  if (checkAnswer(question.value, value)) {
    status.value = 'correct';
    results.value.push({ correct: true, attempts: tries.value, hintsUsed: hintLevel.value });
    playCorrect();
    speak(`答對了！規律是${rule}。${timesText}`);
  } else if (tries.value < MAX_ATTEMPTS) {
    // 第一次答錯：給提示，再試一次
    if (question.value.type === 'next') eliminated.value.push(Number(value));
    input.value = '';
    hintLevel.value = Math.max(hintLevel.value, 1);
    playWrong();
    speak(`再想想看。${hintSpeech(hintLevel.value)}`);
  } else {
    status.value = 'wrong';
    results.value.push({ correct: false, attempts: tries.value, hintsUsed: hintLevel.value });
    playWrong();
    speak(`正確答案是 ${question.value.answer}。規律是${rule}，${reason}。${timesText}`);
  }
}

function choose(value: number) {
  picked.value = value;
  submit(value);
}

function showHint() {
  if (status.value !== 'answering' || hintLevel.value >= HINT_LEVELS) return;
  hintLevel.value++;
  speak(hintSpeech(hintLevel.value));
}

function typeDigit(digit: string) {
  if (status.value !== 'answering' || input.value.length >= maxDigits) return;
  // 不允許開頭多打 0，例如 05
  input.value = input.value === '0' ? digit : input.value + digit;
}

function erase() {
  if (status.value === 'answering') input.value = input.value.slice(0, -1);
}

function next() {
  if (isLast.value) finish();
  else {
    index.value++;
    resetQuestion();
  }
}

function finish() {
  finished.value = true;
  stars.value = starsFor(results.value);
  newBest.value = recordStars(props.level.id, stars.value);
  playStars(stars.value);
  speak(`拿到 ${stars.value} 顆星。${resultMessage.value}`);
}

/** 同一學期的下一關；這回合拿到星星後才會解鎖 */
const nextLevel = computed(() => {
  const term = LEVELS.filter((l) => l.grade === props.level.grade && l.semester === props.level.semester);
  const following = term[term.findIndex((l) => l.id === props.level.id) + 1];
  return following && isUnlocked(following, progress.bestStars) ? following : undefined;
});

const soloCount = computed(() => results.value.filter((r) => questionPoints(r) === 2).length);
const helpedCount = computed(() => results.value.filter((r) => questionPoints(r) === 1).length);

const resultMessage = computed(() => {
  if (stars.value === 3) return '太厲害了！';
  if (stars.value === 2) return '做得很好！再挑戰看看能不能拿到 3 顆星。';
  if (stars.value === 1) return '不錯喔！自己想出來的題目越多，星星就越多。';
  return '多練習幾次，會越來越厲害！';
});

/** 電腦上也可以用實體鍵盤作答 */
function onKeydown(event: KeyboardEvent) {
  if (finished.value) return;
  if (status.value !== 'answering') {
    if (event.key === 'Enter') {
      event.preventDefault();
      next();
    }
    return;
  }
  if (question.value.type !== 'fill') return;
  if (/^[0-9]$/.test(event.key)) typeDigit(event.key);
  else if (event.key === 'Backspace') erase();
  else if (event.key === 'Enter') {
    // 避免 Enter 觸發正好有焦點的鍵盤按鈕
    event.preventDefault();
    if (input.value) submit(input.value);
  }
}

start();

// 每一題出現時自動朗讀
watch(
  [index, finished],
  () => {
    if (!finished.value && settings.autoRead) speak(questionSpeech());
  },
  { immediate: true },
);

onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  stopSpeaking();
});
</script>

<template>
  <header class="bar">
    <button type="button" class="btn secondary back" @click="emit('exit')">← 地圖</button>
    <h1>{{ level.title }}</h1>
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
    <div class="actions">
      <button v-if="nextLevel" type="button" class="btn" @click="emit('play', nextLevel)">
        下一關：{{ nextLevel.title }} →
      </button>
      <button type="button" class="btn" :class="{ secondary: nextLevel }" @click="start">再玩一次</button>
      <button type="button" class="btn secondary" @click="emit('exit')">回地圖</button>
    </div>
  </section>

  <section v-else class="question">
    <div class="prompt-row">
      <p class="prompt">{{ prompt }}</p>
      <button
        v-if="speechSupported"
        type="button"
        class="icon-btn"
        aria-label="再唸一次題目"
        title="再唸一次題目"
        @click="speak(questionSpeech())"
      >
        🔊
      </button>
    </div>

    <SequenceRow
      :terms="question.terms"
      :blank-index="question.blankIndex"
      :blank-text="blankText"
      :status="retrying ? 'retry' : status"
      :gaps="hintLevel >= 1 ? hint.gaps : []"
    />

    <div v-if="status === 'answering' && (retrying || hintLevel > 0)" class="hint-box" aria-live="polite">
      <p v-if="retrying" class="headline">再想想看！</p>
      <p v-if="hintLevel >= 1">💡 {{ HINT_INTRO }}</p>
      <p v-if="hintLevel >= 2">💡 規律是「{{ hint.rule }}」</p>
      <p v-if="hintLevel >= 3">💡 {{ hint.guide }}</p>
    </div>

    <div class="answer-area">
      <ChoiceButtons
        v-if="question.type === 'next'"
        :choices="question.choices"
        :answer="question.answer"
        :picked="picked"
        :status="status"
        :eliminated="eliminated"
        @choose="choose"
      />
      <NumberPad
        v-else
        :disabled="status !== 'answering'"
        :can-submit="input.length > 0"
        @digit="typeDigit"
        @erase="erase"
        @submit="submit(input)"
      />
    </div>

    <div v-if="status === 'answering'" class="hint-row">
      <button type="button" class="btn secondary hint-btn" :disabled="hintLevel >= HINT_LEVELS" @click="showHint">
        💡 {{ hintLevel >= HINT_LEVELS ? '提示用完了' : `提示（還有 ${HINT_LEVELS - hintLevel} 個）` }}
      </button>
    </div>

    <div class="feedback" aria-live="polite">
      <div v-if="status !== 'answering'" class="panel" :class="status">
        <template v-if="status === 'correct'">
          <p class="headline">答對了！🎉</p>
          <p>規律是「{{ explanation.rule }}」</p>
        </template>
        <template v-else>
          <p class="headline">正確答案是 {{ question.answer }}</p>
          <p>規律是「{{ explanation.rule }}」，{{ explanation.reason }}。</p>
        </template>
        <p v-if="explanation.times">{{ explanation.times }}。</p>
        <button type="button" class="btn" @click="next">{{ isLast ? '看結果' : '下一題' }}</button>
      </div>
    </div>
  </section>
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

.question {
  margin-top: 20px;
  padding: 18px 12px 22px;
  background: var(--surface);
  border-radius: 24px;
  box-shadow: var(--shadow);
}

.prompt-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.prompt {
  margin: 0;
  text-align: center;
  font-size: 1.3rem;
  font-weight: 700;
}

.icon-btn {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 2px solid var(--border);
  border-radius: 50%;
  background: var(--surface);
  font-size: 1.2rem;
}

.hint-box {
  margin: 0 auto;
  max-width: 460px;
  padding: 10px 16px;
  border-radius: var(--radius);
  background: var(--accent-soft);
  text-align: center;
}

.hint-box p {
  margin: 2px 0;
}

.hint-box .headline {
  color: var(--wrong);
}

.answer-area {
  margin-top: 18px;
}

.hint-row {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}

.hint-btn {
  min-height: 44px;
  padding: 6px 18px;
  font-size: 0.95rem;
}

.hint-btn:disabled {
  opacity: 0.5;
}

.feedback {
  margin-top: 18px;
}

.panel {
  padding: 14px 18px;
  border-radius: var(--radius);
  text-align: center;
}

.panel p {
  margin: 0 0 6px;
}

.panel .btn {
  margin-top: 8px;
}

.panel.correct {
  background: var(--correct-soft);
}

.panel.wrong {
  background: var(--wrong-soft);
}

.headline {
  font-size: 1.3rem;
  font-weight: 800;
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
