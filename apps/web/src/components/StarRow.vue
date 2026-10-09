<script setup lang="ts">
withDefaults(defineProps<{ count: number; size?: number; animate?: boolean }>(), { size: 18, animate: false });
</script>

<template>
  <span class="stars" :aria-label="`${count} 顆星（共 3 顆）`" role="img">
    <svg
      v-for="i in 3"
      :key="i"
      :width="size"
      :height="size"
      viewBox="0 0 24 24"
      :class="{ on: i <= count, pop: animate && i <= count }"
      :style="animate ? { animationDelay: `${(i - 1) * 0.22}s` } : undefined"
      aria-hidden="true"
    >
      <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z" />
    </svg>
  </span>
</template>

<style scoped>
.stars {
  display: inline-flex;
  gap: 2px;
}

svg {
  fill: var(--border);
  stroke: var(--stone-edge);
  stroke-width: 1;
}

svg.on {
  fill: var(--accent);
  stroke: #d48806;
}

.pop {
  animation: pop 0.4s ease-out both;
}

@keyframes pop {
  0% {
    transform: scale(0);
  }
  70% {
    transform: scale(1.3);
  }
  100% {
    transform: scale(1);
  }
}
</style>
