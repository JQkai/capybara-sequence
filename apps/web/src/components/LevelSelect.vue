<script setup lang="ts">
import { LEVELS, type Level } from '@kidstudy/game-core';
import Capybara from './Capybara.vue';

defineEmits<{ select: [level: Level] }>();

const GRADE_NAMES = { 1: '一年級', 2: '二年級' } as const;
const SEMESTER_NAMES = { 1: '上學期', 2: '下學期' } as const;

const groups = [1, 2].flatMap((grade) =>
  [1, 2].map((semester) => ({
    title: `${GRADE_NAMES[grade as 1 | 2]}${SEMESTER_NAMES[semester as 1 | 2]}`,
    levels: LEVELS.filter((level) => level.grade === grade && level.semester === semester),
  })),
);
</script>

<template>
  <header class="hero">
    <Capybara :size="96" class="mascot" />
    <h1>數列卡皮巴拉</h1>
    <p>找出數字的規律，陪卡皮巴拉踩著石頭去泡溫泉！</p>
  </header>

  <section v-for="group in groups" :key="group.title" class="group">
    <h2>{{ group.title }}</h2>
    <div class="grid">
      <button
        v-for="level in group.levels"
        :key="level.id"
        class="card"
        type="button"
        @click="$emit('select', level)"
      >
        <span class="title">{{ level.title }}</span>
        <span class="desc">{{ level.description }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.hero {
  text-align: center;
  padding: 12px 0 8px;
}

.mascot {
  margin: 0 auto;
}

h1 {
  margin: 8px 0 4px;
  font-size: 2rem;
  color: var(--primary-dark);
}

.hero p {
  margin: 0;
  color: var(--text-soft);
}

.group {
  margin-top: 28px;
}

h2 {
  font-size: 1.2rem;
  margin: 0 0 12px;
  padding-left: 12px;
  border-left: 6px solid var(--accent);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 92px;
  padding: 14px 18px;
  text-align: left;
  background: var(--surface);
  border: 2px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  transition: transform 0.08s, border-color 0.15s;
}

.card:hover {
  border-color: var(--primary);
}

.card:active {
  transform: translateY(2px);
}

.title {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--primary-dark);
}

.desc {
  font-size: 0.95rem;
  color: var(--text-soft);
}
</style>
