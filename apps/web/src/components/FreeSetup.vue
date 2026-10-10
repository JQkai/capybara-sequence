<script setup lang="ts">
import { computed } from 'vue';
import {
  FAMILY_GROUPS,
  FREE_PRESETS,
  FREE_TYPES,
  QUESTION_TYPE_NAMES,
  type FamilyGroup,
  type FreePresetId,
  type QuestionType,
} from '@kidstudy/game-core';
import Capybara from './Capybara.vue';
import { progress, settings, type FreeKey } from '../store';

const emit = defineEmits<{ start: [key: FreeKey]; exit: [] }>();

const presets = Object.entries(FREE_PRESETS) as [FreePresetId, (typeof FREE_PRESETS)[FreePresetId]][];
const groups = Object.entries(FAMILY_GROUPS) as [FamilyGroup, (typeof FAMILY_GROUPS)[FamilyGroup]][];
const custom = settings.freeCustom;

/** 勾選或取消；最少要留一個 */
function toggle<T>(list: T[], item: T) {
  const i = list.indexOf(item);
  if (i >= 0) {
    if (list.length > 1) list.splice(i, 1);
  } else list.push(item);
}

const groupExamples: Record<FamilyGroup, string> = {
  basic: '238、255、272… 或 4、7、12、15…',
  growing: '3、4、6、9、13…',
  multiply: '3、6、12、24… 或 800、400、200…',
  advanced: '1、3、7、15… 或 1、2、3、5、8…',
};

const customReady = computed(() => custom.groups.length > 0 && custom.types.length > 0);
</script>

<template>
  <header class="bar">
    <button type="button" class="btn secondary back" @click="emit('exit')">← 地圖</button>
  </header>

  <section class="hero">
    <Capybara :size="72" class="mascot" />
    <h1>自由模式</h1>
    <p>不分年級，挑戰更多種規律（數字都在 1000 以內）</p>
    <p class="rule-note">第一次就答對才算「連續答對」</p>
  </section>

  <section class="presets" aria-label="選擇難度">
    <button v-for="[id, preset] in presets" :key="id" type="button" class="preset" :class="id" @click="emit('start', id)">
      <span class="name">
        {{ preset.name }}
        <span class="grades">{{ preset.grades }}</span>
      </span>
      <span class="desc">{{ preset.description }}</span>
      <span class="best">最高連續答對 {{ progress.freeBest[id] ?? 0 }} 題</span>
    </button>
  </section>

  <section class="custom" aria-label="自訂">
    <h2>自訂</h2>

    <p class="label">要出哪些規律？</p>
    <div class="options">
      <label v-for="[id, group] in groups" :key="id" class="check">
        <input type="checkbox" :checked="custom.groups.includes(id)" @change="toggle(custom.groups, id)" />
        <span>
          <strong>{{ group.name }}</strong>
          <small>{{ groupExamples[id] }}</small>
        </span>
      </label>
    </div>

    <p class="label">數字範圍</p>
    <div class="segmented" role="radiogroup" aria-label="數字範圍">
      <button
        v-for="max in [100, 1000] as const"
        :key="max"
        type="button"
        role="radio"
        :aria-checked="custom.max === max"
        @click="custom.max = max"
      >
        {{ max }} 以內
      </button>
    </div>

    <p class="label">填空格時有幾個空格</p>
    <div class="segmented" role="radiogroup" aria-label="空格數">
      <button
        v-for="n in [1, 2, 3]"
        :key="n"
        type="button"
        role="radio"
        :aria-checked="custom.blanks === n"
        @click="custom.blanks = n"
      >
        {{ n }} 個
      </button>
    </div>

    <p class="label">題型</p>
    <div class="chips">
      <button
        v-for="type in FREE_TYPES"
        :key="type"
        type="button"
        class="chip"
        :aria-pressed="custom.types.includes(type)"
        @click="toggle<QuestionType>(custom.types, type)"
      >
        {{ QUESTION_TYPE_NAMES[type] }}
      </button>
    </div>

    <div class="start-row">
      <span class="best">最高連續答對 {{ progress.freeBest.custom ?? 0 }} 題</span>
      <button type="button" class="btn" :disabled="!customReady" @click="emit('start', 'custom')">開始</button>
    </div>
  </section>
</template>

<style scoped>
.bar {
  display: flex;
}

.back {
  min-height: 44px;
  padding: 6px 16px;
  font-size: 0.95rem;
}

.hero {
  text-align: center;
}

.mascot {
  margin: 0 auto;
}

h1 {
  margin: 6px 0 2px;
  font-size: 1.8rem;
  color: var(--primary-dark);
}

.hero p {
  margin: 0;
  color: var(--text-soft);
}

.presets {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
  gap: 12px;
  margin-top: 20px;
}

.preset {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 18px;
  text-align: left;
  background: var(--surface);
  border: 2px solid var(--border);
  border-left-width: 8px;
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

.preset:active {
  transform: translateY(2px);
}

.preset.warm {
  border-left-color: var(--correct);
}

.preset.challenge {
  border-left-color: var(--accent);
}

.preset.brain {
  border-left-color: var(--wrong);
}

.preset.genius {
  border-left-color: var(--genius);
}

.name {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--primary-dark);
}

.grades {
  margin-left: 6px;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--primary-soft);
  font-size: 0.8rem;
  font-weight: 700;
  vertical-align: middle;
}

.rule-note {
  margin-top: 4px !important;
  font-size: 0.85rem;
}

.desc {
  font-size: 0.95rem;
  color: var(--text);
}

.best {
  font-size: 0.85rem;
  color: var(--text-soft);
}

.custom {
  margin-top: 24px;
  padding: 16px 18px 18px;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

h2 {
  margin: 0;
  font-size: 1.2rem;
  color: var(--primary-dark);
}

.label {
  margin: 14px 0 6px;
  font-weight: 700;
}

.options {
  display: grid;
  gap: 8px;
}

.check {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  cursor: pointer;
}

.check input {
  width: 22px;
  height: 22px;
  margin-top: 2px;
  accent-color: var(--primary);
}

.check span {
  display: flex;
  flex-direction: column;
}

.check small {
  color: var(--text-soft);
}

.segmented,
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.segmented button,
.chip {
  min-height: 40px;
  padding: 4px 16px;
  border: 2px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  font-weight: 700;
  color: var(--text-soft);
}

.segmented button[aria-checked='true'],
.chip[aria-pressed='true'] {
  border-color: var(--primary);
  background: var(--primary-soft);
  color: var(--primary-dark);
}

.start-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 18px;
}

.start-row .btn:disabled {
  opacity: 0.5;
}
</style>
