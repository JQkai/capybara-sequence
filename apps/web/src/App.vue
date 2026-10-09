<script setup lang="ts">
import { ref } from 'vue';
import type { Level } from '@kidstudy/game-core';
import LevelSelect from './components/LevelSelect.vue';
import PlayRound from './components/PlayRound.vue';

const current = ref<Level | null>(null);
</script>

<template>
  <main class="app">
    <PlayRound v-if="current" :key="current.id" :level="current" @exit="current = null" />
    <LevelSelect v-else @select="current = $event" />
  </main>
</template>

<style scoped>
.app {
  max-width: 760px;
  margin: 0 auto;
  padding: 16px 16px 40px;
}
</style>
