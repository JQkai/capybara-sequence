<script setup lang="ts">
import { ref } from 'vue';
import type { Level, Mode } from '@kidstudy/game-core';
import MapView from './components/MapView.vue';
import PlayRound from './components/PlayRound.vue';
import { settings } from './store';

const current = ref<{ level: Level; mode: Mode } | null>(null);

function play(level: Level, mode: Mode) {
  // 回到地圖時停在剛剛玩的難度
  settings.mode = mode;
  current.value = { level, mode };
}
</script>

<template>
  <main class="app">
    <PlayRound
      v-if="current"
      :key="`${current.level.id}@${current.mode}`"
      :level="current.level"
      :mode="current.mode"
      @exit="current = null"
      @play="play"
    />
    <MapView v-else @select="play($event, settings.mode)" />
  </main>
</template>

<style scoped>
.app {
  max-width: 760px;
  margin: 0 auto;
  padding: 16px 16px 40px;
}
</style>
