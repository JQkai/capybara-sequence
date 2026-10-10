<script setup lang="ts">
import { ref } from 'vue';
import type { Level, Mode } from '@kidstudy/game-core';
import MapView from './components/MapView.vue';
import PlayRound from './components/PlayRound.vue';
import FreeSetup from './components/FreeSetup.vue';
import PlayFree from './components/PlayFree.vue';
import { settings, type FreeKey } from './store';

type View =
  | { kind: 'map' }
  | { kind: 'play'; level: Level; mode: Mode }
  | { kind: 'freeSetup' }
  | { kind: 'free'; key: FreeKey };

const view = ref<View>({ kind: 'map' });

function show(next: View) {
  view.value = next;
  window.scrollTo(0, 0);
}

function play(level: Level, mode: Mode) {
  // 回到地圖時停在剛剛玩的難度
  settings.mode = mode;
  show({ kind: 'play', level, mode });
}
</script>

<template>
  <main class="app">
    <PlayRound
      v-if="view.kind === 'play'"
      :key="`${view.level.id}@${view.mode}@${settings.practice}`"
      :level="view.level"
      :mode="view.mode"
      :practice="settings.practice"
      @exit="show({ kind: 'map' })"
      @play="play"
    />
    <FreeSetup
      v-else-if="view.kind === 'freeSetup'"
      @exit="show({ kind: 'map' })"
      @start="show({ kind: 'free', key: $event })"
    />
    <PlayFree v-else-if="view.kind === 'free'" :free-key="view.key" @exit="show({ kind: 'freeSetup' })" />
    <MapView v-else @select="play($event, settings.mode)" @free="show({ kind: 'freeSetup' })" />
  </main>
</template>

<style scoped>
.app {
  max-width: 760px;
  margin: 0 auto;
  padding: 16px 16px 40px;
}
</style>
