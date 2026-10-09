<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import {
  checkAnswer,
  createRng,
  explain,
  generateRound,
  levelRange,
  type Level,
  type Question,
} from '@kidstudy/game-core';
import SequenceRow from './SequenceRow.vue';
import NumberPad from './NumberPad.vue';
import ChoiceButtons from './ChoiceButtons.vue';
import Capybara from './Capybara.vue';

const ROUND_SIZE = 5;

const props = defineProps<{ level: Level }>();
const emit = defineEmits<{ exit: [] }>();

const questions = ref<Question[]>([]);
const index = ref(0);
const input = ref('');
const picked = ref<number | null>(null);
const status = ref<'answering' | 'correct' | 'wrong'>('answering');
const score = ref(0);
const finished = ref(false);

/** 輸入框最多幾位數：依關卡最大的數決定，例如 1000 以內是 4 位 */
const maxDigits = String(levelRange(props.level).max).length;

const question = computed(() => questions.value[index.value]!);
const explanation = computed(() => explain(question.value));
const isLast = computed(() => index.value === questions.value.length - 1);
const prompt = computed(() => (question.value.type === 'next' ? '下一顆石頭上是哪個數？' : '空格裡要填多少？'));
const blankText = computed(() => {
  if (status.value !== 'answering' && question.value.type === 'next') return String(picked.value);
  return input.value || '?';
});

function start() {
  questions.value = generateRound(props.level, createRng(Date.now()), ROUND_SIZE);
  index.value = 0;
  score.value = 0;
  finished.value = false;
  resetAnswer();
}

function resetAnswer() {
  input.value = '';
  picked.value = null;
  status.value = 'answering';
}

function submit(value: number | string) {
  if (status.value !== 'answering') return;
  const correct = checkAnswer(question.value, value);
  status.value = correct ? 'correct' : 'wrong';
  if (correct) score.value++;
}

function choose(value: number) {
  picked.value = value;
  submit(value);
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
  if (isLast.value) {
    finished.value = true;
  } else {
    index.value++;
    resetAnswer();
  }
}

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

const resultMessage = computed(() => {
  if (score.value === ROUND_SIZE) return '全部答對，太厲害了！';
  if (score.value >= ROUND_SIZE - 2) return '做得很好！';
  return '多練習幾次，會越來越厲害！';
});

start();
onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <header class="bar">
    <button type="button" class="btn secondary back" @click="emit('exit')">← 關卡</button>
    <h1>{{ level.title }}</h1>
    <ol class="progress" :aria-label="`第 ${index + 1} 題，共 ${questions.length} 題`">
      <li
        v-for="(_, i) in questions"
        :key="i"
        :class="{ done: i < index || finished, current: i === index && !finished }"
      />
    </ol>
  </header>

  <section v-if="finished" class="result">
    <div class="big" aria-hidden="true">
      <Capybara :size="96" />
      <span v-if="score === ROUND_SIZE" class="trophy">🏆</span>
    </div>
    <p class="score">答對 {{ score }} 題（共 {{ ROUND_SIZE }} 題）</p>
    <p>{{ resultMessage }}</p>
    <div class="actions">
      <button type="button" class="btn" @click="start">再玩一次</button>
      <button type="button" class="btn secondary" @click="emit('exit')">選別的關卡</button>
    </div>
  </section>

  <section v-else class="question">
    <p class="prompt">{{ prompt }}</p>
    <SequenceRow
      :terms="question.terms"
      :blank-index="question.blankIndex"
      :blank-text="blankText"
      :status="status"
    />

    <div class="answer-area">
      <ChoiceButtons
        v-if="question.type === 'next'"
        :choices="question.choices"
        :answer="question.answer"
        :picked="picked"
        :status="status"
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

.progress li.done {
  background: var(--primary);
}

.progress li.current {
  background: var(--accent);
}

.question {
  margin-top: 20px;
  padding: 20px 12px 24px;
  background: var(--surface);
  border-radius: 24px;
  box-shadow: var(--shadow);
}

.prompt {
  margin: 0;
  text-align: center;
  font-size: 1.3rem;
  font-weight: 700;
}

.answer-area {
  margin-top: 20px;
}

.feedback {
  margin-top: 20px;
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
  font-size: 1.4rem;
  font-weight: 800;
}

.result {
  margin-top: 40px;
  text-align: center;
}

.big {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  gap: 8px;
}

.trophy {
  font-size: 56px;
  line-height: 1;
}

.score {
  font-size: 1.6rem;
  font-weight: 800;
  margin: 12px 0 4px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  margin-top: 20px;
}
</style>
