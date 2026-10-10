<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  HINT_LEVELS,
  LEVELS,
  MAX_ATTEMPTS,
  MODES,
  MODE_NAMES,
  PRACTICE_NAMES,
  checkAnswer,
  createRng,
  explain,
  generateRound,
  hintFor,
  levelRange,
  questionPoints,
  shownTerms,
  stepGaps,
  starsFor,
  type Level,
  type Mode,
  type Practice,
  type Question,
  type QuestionResult,
} from '@kidstudy/game-core';
import SequenceRow, { type Cell, type CellStyle } from './SequenceRow.vue';
import NumberPad from './NumberPad.vue';
import ChoiceButtons from './ChoiceButtons.vue';
import Capybara from './Capybara.vue';
import StarRow from './StarRow.vue';
import { recordStars, settings } from '../store';
import { speak, speechSupported, stopSpeaking } from '../speech';
import { playCorrect, playStars, playWrong } from '../sound';

const ROUND_SIZE = 5;

const props = defineProps<{ level: Level; mode: Mode; practice: Practice }>();
const emit = defineEmits<{ exit: []; play: [level: Level, mode: Mode] }>();

const questions = ref<Question[]>([]);
const index = ref(0);
/** 補空格題每一格輸入的內容，key 是空格位置 */
const inputs = ref<Record<number, string>>({});
/** 正在填的空格 */
const active = ref(0);
/** 已經答對、不用再填的空格（再試一次時） */
const locked = ref<number[]>([]);
/** 上一次檢查時答錯的空格 */
const wrongBlanks = ref<number[]>([]);
/** 選擇題選的數 */
const picked = ref<number | null>(null);
const status = ref<'answering' | 'correct' | 'wrong'>('answering');
/** 這題已經送出幾次答案 */
const tries = ref(0);
/** 這題打開到第幾層提示（0＝沒用提示） */
const hintLevel = ref(0);
/** 選擇題選錯的選項（數）、找錯誤點錯的石頭（位置），再試一次時不能再選 */
const eliminated = ref<number[]>([]);
const results = ref<QuestionResult[]>([]);
const finished = ref(false);
const stars = ref(0);
const newBest = ref(false);

/** 輸入框最多幾位數：依關卡最大的數決定，例如 1000 以內是 4 位 */
const maxDigits = String(levelRange(props.level, props.mode).max).length;

const question = computed(() => questions.value[index.value]!);
const blanks = computed(() => question.value.blanks);
const multi = computed(() => blanks.value.length > 1);
const openBlanks = computed(() => blanks.value.filter((b) => !locked.value.includes(b)));
const explanation = computed(() => explain(question.value));
const hint = computed(() => hintFor(question.value, active.value));
const isLast = computed(() => index.value === questions.value.length - 1);
const retrying = computed(() => status.value === 'answering' && tries.value > 0);
const allFilled = computed(() => openBlanks.value.every((b) => inputs.value[b]));
const harderMode = computed(() => MODES[MODES.indexOf(props.mode) + 1]);

/** 答錯一次、正在再試時的標題 */
const retryHeadline = computed(() => {
  const { type } = question.value;
  const right = locked.value.length;
  if (type === 'error') return '不是這一顆，再找找看！';
  if (type === 'order') return right > 0 ? `排對 ${right} 顆了！其他的再排排看` : '再排排看！';
  return multi.value && right > 0 ? `答對 ${right} 格了！紅色的格子再想想看` : '再想想看！';
});

const orderWord = computed(() => (question.value.step > 0 ? '從小排到大' : '從大排到小'));

const prompt = computed(() => {
  const { type } = question.value;
  if (type === 'next') return '下一顆石頭上是哪個數？';
  if (type === 'error') return '哪一個數寫錯了？點一下那顆石頭';
  if (type === 'order') return `把數字卡${orderWord.value}`;
  return multi.value ? '每個空格裡要填多少？' : '空格裡要填多少？';
});

/** 空格（作答位置）裡顯示的內容 */
function blankText(b: number, k: number): string {
  if (question.value.type === 'next') return status.value === 'answering' ? '?' : String(picked.value);
  if (status.value === 'wrong' && wrongBlanks.value.includes(b)) return String(question.value.answers[k]);
  return inputs.value[b] || '?';
}

function blankStyle(b: number): CellStyle {
  if (status.value === 'correct') return 'correct';
  if (status.value === 'wrong') {
    // 選擇題答錯顯示孩子選的數；補空格、排一排答錯直接在格子裡顯示正確答案
    if (!wrongBlanks.value.includes(b)) return 'correct';
    return question.value.type === 'next' ? 'wrong' : 'reveal';
  }
  if (locked.value.includes(b)) return 'correct';
  if (wrongBlanks.value.includes(b) && !inputs.value[b]) return 'retry';
  if (b === active.value && multi.value) return 'active';
  return 'answering';
}

/** 每顆石頭的內容和樣子 */
const cells = computed<Cell[]>(() => {
  const q = question.value;
  const answering = status.value === 'answering';
  if (q.type === 'error') {
    const at = q.blanks[0]!;
    return shownTerms(q).map((value, i) => {
      if (i === at && status.value === 'correct') return { text: String(q.answers[0]), style: 'correct' };
      if (i === at && status.value === 'wrong') return { text: String(q.answers[0]), style: 'reveal' };
      if (eliminated.value.includes(i)) return { text: String(value), style: 'crossed' };
      return { text: String(value), style: 'number', selectable: answering };
    });
  }
  return q.terms.map((term, i) => {
    const k = q.blanks.indexOf(i);
    if (k < 0) return { text: String(term), style: 'number' };
    const selectable = answering && multi.value && openBlanks.value.includes(i);
    return { text: blankText(i, k), style: blankStyle(i), selectable };
  });
});

/** 卡皮巴拉站的位置：作答時站在正在填的格子上；找錯誤作答時不站（免得像在提示答案） */
const mascotAt = computed(() => {
  const q = question.value;
  if (q.type === 'error') return status.value === 'answering' ? -1 : q.blanks[0]!;
  return status.value === 'answering' ? active.value : q.blanks[0]!;
});

/** 石頭下方標的差：打開提示時標出提示的差；排一排作答結束後標出每兩顆的差，讓孩子看到排好的數字有規律 */
const shownGaps = computed(() => {
  if (question.value.type === 'order' && status.value !== 'answering') return stepGaps(question.value);
  return hintLevel.value >= 1 ? hint.value.gaps : [];
});

/** 排一排還沒放進石頭的數字卡 */
const pool = computed(() => {
  const placed = new Set(Object.values(inputs.value).filter(Boolean));
  return (question.value.cards ?? []).filter((c) => !placed.has(String(c)));
});

function hintSpeech(level: number): string {
  if (level === 1) return hint.value.intro;
  if (level === 2) return `規律是${hint.value.rule}。`;
  return hint.value.guide;
}

function questionSpeech(): string {
  const q = question.value;
  if (q.type === 'error') return `${shownTerms(q).join('，')}。哪一個數寫錯了？`;
  if (q.type === 'order') return `把 ${(q.cards ?? []).join('、')} ${orderWord.value}。`;
  const row = q.terms.map((t, i) => (q.blanks.includes(i) ? '空格' : String(t))).join('，');
  const options = q.type === 'next' ? `是 ${q.choices.join('、')} 裡的哪一個？` : '';
  return `${row}。${prompt.value}${options}`;
}

function start() {
  questions.value = generateRound(props.level, createRng(Date.now()), {
    count: ROUND_SIZE,
    mode: props.mode,
    practice: props.practice,
  });
  index.value = 0;
  results.value = [];
  finished.value = false;
  resetQuestion();
}

function resetQuestion() {
  inputs.value = {};
  active.value = blanks.value[0]!;
  locked.value = [];
  wrongBlanks.value = [];
  picked.value = null;
  status.value = 'answering';
  tries.value = 0;
  hintLevel.value = 0;
  eliminated.value = [];
}

function timesText(): string {
  return explanation.value.times.length ? `${explanation.value.times.join('，')}。` : '';
}

function markCorrect() {
  status.value = 'correct';
  results.value.push({ correct: true, attempts: tries.value, hintsUsed: hintLevel.value });
  playCorrect();
  const q = question.value;
  const fixed = q.type === 'error' ? `${q.wrong} 應該是 ${q.answers[0]}。` : '';
  speak(`答對了！${fixed}規律是${explanation.value.rule}。${timesText()}`);
}

function markWrong() {
  status.value = 'wrong';
  results.value.push({ correct: false, attempts: tries.value, hintsUsed: hintLevel.value });
  playWrong();
  const q = question.value;
  const { rule, reasons } = explanation.value;
  if (q.type === 'error') {
    speak(`寫錯的是 ${q.wrong}，應該是 ${q.answers[0]}。規律是${rule}，${reasons.join('；')}。${timesText()}`);
  } else if (q.type === 'order') {
    speak(`正確的順序是 ${q.terms.join('、')}。規律是${rule}。`);
  } else {
    const answers = q.answers.join('、');
    speak(`正確答案${multi.value ? '依序' : ''}是 ${answers}。規律是${rule}，${reasons.join('；')}。${timesText()}`);
  }
}

/**
 * 答錯一次、再試：補空格、選擇題、排一排會自動打開第 1 層提示。
 * 找錯誤不自動打開：它的第 1 層會標出每兩顆的差，兩個不一樣的差剛好夾著寫錯的那顆，等於直接說出答案；
 * 孩子想看提示可以自己按「提示」。
 */
function retry(message: string, autoHint = true) {
  if (autoHint) hintLevel.value = Math.max(hintLevel.value, 1);
  playWrong();
  speak(hintLevel.value > 0 ? `${message}${hintSpeech(hintLevel.value)}` : message);
}

/** 選擇題 */
function choose(value: number) {
  if (status.value !== 'answering') return;
  picked.value = value;
  tries.value++;
  if (checkAnswer(question.value, value)) return markCorrect();
  wrongBlanks.value = [blanks.value[0]!];
  if (tries.value < MAX_ATTEMPTS) {
    eliminated.value.push(value);
    picked.value = null;
    retry('再想想看。');
  } else markWrong();
}

/** 補空格：全部填好才檢查；答對的格子保留，答錯的清掉再試一次 */
function checkFill() {
  if (status.value !== 'answering' || !allFilled.value) return;
  tries.value++;
  const wrong = openBlanks.value.filter((b) => !checkAnswer(question.value, inputs.value[b]!, b));
  if (wrong.length === 0) return markCorrect();
  wrongBlanks.value = wrong;
  if (tries.value < MAX_ATTEMPTS) {
    locked.value = blanks.value.filter((b) => !wrong.includes(b));
    for (const b of wrong) inputs.value[b] = '';
    active.value = wrong[0]!;
    const right = blanks.value.length - wrong.length;
    if (question.value.type === 'order') retry(right > 0 ? `排對 ${right} 顆了！其他的再排排看。` : '再排排看。');
    else retry(multi.value && right > 0 ? `答對 ${right} 格了！紅色的格子再想想看。` : '再想想看。');
  } else markWrong();
}

/** 確定鍵：還有空格沒填就跳到下一個空格，全部填好才檢查 */
function confirm() {
  if (status.value !== 'answering' || !inputs.value[active.value]) return;
  if (allFilled.value) return checkFill();
  const open = openBlanks.value;
  const from = open.indexOf(active.value);
  const nextEmpty = [...open.slice(from + 1), ...open.slice(0, from)].find((b) => !inputs.value[b]);
  if (nextEmpty !== undefined) active.value = nextEmpty;
}

function selectBlank(position: number) {
  if (status.value === 'answering' && openBlanks.value.includes(position)) active.value = position;
}

/** 找錯誤：點一顆石頭 */
function pickStone(position: number) {
  if (status.value !== 'answering' || eliminated.value.includes(position)) return;
  tries.value++;
  if (position === blanks.value[0]) return markCorrect();
  eliminated.value.push(position);
  wrongBlanks.value = [blanks.value[0]!];
  if (tries.value < MAX_ATTEMPTS) retry('不是這一顆，再找找看。', false);
  else markWrong();
}

/** 排一排：把數字卡放進正在選的石頭，再跳到下一顆空的石頭 */
function placeCard(value: number) {
  if (status.value !== 'answering') return;
  inputs.value[active.value] = String(value);
  const open = openBlanks.value;
  const from = open.indexOf(active.value);
  const nextEmpty = [...open.slice(from + 1), ...open.slice(0, from)].find((b) => !inputs.value[b]);
  if (nextEmpty !== undefined) active.value = nextEmpty;
}

/** 排一排：點石頭選它；石頭上已經有卡就拿回來 */
function tapSlot(position: number) {
  if (status.value !== 'answering' || !openBlanks.value.includes(position)) return;
  if (inputs.value[position]) inputs.value[position] = '';
  active.value = position;
}

function tapCell(position: number) {
  const { type } = question.value;
  if (type === 'error') pickStone(position);
  else if (type === 'order') tapSlot(position);
  else selectBlank(position);
}

function moveActive(direction: 1 | -1) {
  const open = openBlanks.value;
  const next = open[open.indexOf(active.value) + direction];
  if (next !== undefined) active.value = next;
}

function showHint() {
  if (status.value !== 'answering' || hintLevel.value >= HINT_LEVELS) return;
  hintLevel.value++;
  speak(hintSpeech(hintLevel.value));
}

function typeDigit(digit: string) {
  const current = inputs.value[active.value] ?? '';
  if (status.value !== 'answering' || current.length >= maxDigits) return;
  // 不允許開頭多打 0，例如 05
  inputs.value[active.value] = current === '0' ? digit : current + digit;
}

function erase() {
  if (status.value === 'answering') inputs.value[active.value] = (inputs.value[active.value] ?? '').slice(0, -1);
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
  if (question.value.type === 'order' && event.key === 'Enter') {
    event.preventDefault();
    if (allFilled.value) checkFill();
    return;
  }
  if (question.value.type !== 'fill') return;
  if (/^[0-9]$/.test(event.key)) typeDigit(event.key);
  else if (event.key === 'Backspace') erase();
  else if (event.key === 'ArrowRight') moveActive(1);
  else if (event.key === 'ArrowLeft') moveActive(-1);
  else if (event.key === 'Enter') {
    // 避免 Enter 觸發正好有焦點的鍵盤按鈕
    event.preventDefault();
    confirm();
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
    <p v-if="question.type === 'order' && status === 'answering'" class="tip">點數字卡放進石頭，點石頭可以把卡拿回來</p>
    <p v-else-if="question.type === 'fill' && multi && status === 'answering'" class="tip">
      點一下空格，可以選要填哪一格
    </p>

    <SequenceRow :cells="cells" :mascot-at="mascotAt" :gaps="shownGaps" @select="tapCell" />

    <!-- 提示框作答後也留著，下方的選項才不會往上跳，避免孩子連點時點錯 -->
    <div v-if="hintLevel > 0 || retrying" class="hint-box" aria-live="polite">
      <p v-if="retrying" class="headline">{{ retryHeadline }}</p>
      <p v-if="hintLevel >= 1">💡 {{ hint.intro }}</p>
      <p v-if="hintLevel >= 2">💡 規律是「{{ hint.rule }}」</p>
      <p v-if="hintLevel >= 3">💡 {{ hint.guide }}</p>
    </div>

    <div class="answer-area">
      <ChoiceButtons
        v-if="question.type === 'next'"
        :choices="question.choices"
        :answer="question.answers[0]!"
        :picked="picked"
        :status="status"
        :eliminated="eliminated"
        @choose="choose"
      />
      <div v-else-if="question.type === 'order'" class="cards">
        <div class="pool" role="group" aria-label="數字卡">
          <button
            v-for="card in pool"
            :key="card"
            type="button"
            class="card"
            :disabled="status !== 'answering'"
            @click="placeCard(card)"
          >
            {{ card }}
          </button>
          <p v-if="pool.length === 0 && status === 'answering'" class="pool-empty">數字卡都放好了，按「確定」檢查</p>
        </div>
        <button v-if="status === 'answering'" type="button" class="btn" :disabled="!allFilled" @click="checkFill">
          確定
        </button>
      </div>
      <NumberPad
        v-else-if="question.type === 'fill'"
        :disabled="status !== 'answering'"
        :can-submit="!!inputs[active]"
        :submit-label="allFilled ? '確定' : '下一格'"
        @digit="typeDigit"
        @erase="erase"
        @submit="confirm"
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
          <p v-if="question.type === 'error'">{{ question.wrong }} 應該是 {{ question.answers[0] }}，規律是「{{ explanation.rule }}」</p>
          <p v-else>規律是「{{ explanation.rule }}」</p>
        </template>
        <template v-else-if="question.type === 'error'">
          <p class="headline">寫錯的是 {{ question.wrong }}，應該是 {{ question.answers[0] }}</p>
          <p>規律是「{{ explanation.rule }}」，{{ explanation.reasons.join('；') }}。</p>
        </template>
        <template v-else-if="question.type === 'order'">
          <p class="headline">正確的順序是 {{ question.terms.join('、') }}</p>
          <p>規律是「{{ explanation.rule }}」</p>
        </template>
        <template v-else>
          <p class="headline">正確答案{{ multi ? '依序' : '' }}是 {{ question.answers.join('、') }}</p>
          <p>規律是「{{ explanation.rule }}」，{{ explanation.reasons.join('；') }}。</p>
        </template>
        <p v-if="explanation.times.length">{{ explanation.times.join('，') }}。</p>
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

.tip {
  margin: 4px 0 0;
  text-align: center;
  font-size: 0.9rem;
  color: var(--text-soft);
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

.cards {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.pool {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  min-height: 64px;
}

.card {
  min-width: 64px;
  min-height: 60px;
  padding: 6px 14px;
  border: 3px solid var(--accent);
  border-radius: 14px;
  background: var(--accent-soft);
  font-size: 1.6rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  box-shadow: 0 4px 0 #d9a441;
}

.card:active:not(:disabled) {
  transform: translateY(3px);
  box-shadow: 0 1px 0 #d9a441;
}

.pool-empty {
  margin: 0;
  align-self: center;
  color: var(--text-soft);
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
