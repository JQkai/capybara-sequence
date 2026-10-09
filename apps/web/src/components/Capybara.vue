<script setup lang="ts">
/** 頭頂柚子的卡皮巴拉，正面的頭。size 是寬高（px）。 */
withDefaults(defineProps<{ size?: number }>(), { size: 64 });
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 100 100" aria-hidden="true" class="capybara">
    <!-- 小耳朵 -->
    <ellipse cx="27" cy="28" rx="6.5" ry="5.5" fill="#6e4a2b" />
    <ellipse cx="73" cy="28" rx="6.5" ry="5.5" fill="#6e4a2b" />
    <!-- 方方的頭 -->
    <rect x="17" y="25" width="66" height="70" rx="24" fill="#a87a4d" />
    <!-- 腮紅 -->
    <ellipse cx="26" cy="57" rx="5.5" ry="3.5" fill="#f2a38a" opacity="0.6" />
    <ellipse cx="74" cy="57" rx="5.5" ry="3.5" fill="#f2a38a" opacity="0.6" />
    <!-- 瞇瞇眼 -->
    <path d="M28 46 Q33.5 50 39 46" stroke="#2b1a0e" stroke-width="3" fill="none" stroke-linecap="round" />
    <path d="M61 46 Q66.5 50 72 46" stroke="#2b1a0e" stroke-width="3" fill="none" stroke-linecap="round" />
    <!-- 又寬又鈍的大鼻子 -->
    <rect x="25" y="59" width="50" height="32" rx="16" fill="#8c6239" />
    <ellipse cx="41" cy="67" rx="3.6" ry="2.2" fill="#3b2614" transform="rotate(-12 41 67)" />
    <ellipse cx="59" cy="67" rx="3.6" ry="2.2" fill="#3b2614" transform="rotate(12 59 67)" />
    <path d="M50 70 V77 M44 80 Q50 84 56 80" stroke="#3b2614" stroke-width="2.4" fill="none" stroke-linecap="round" />
    <!-- 頭頂的柚子 -->
    <circle cx="50" cy="17" r="11" fill="#f4a62a" />
    <circle cx="46" cy="13" r="3" fill="#ffd27a" />
    <ellipse cx="57" cy="6" rx="6" ry="3" fill="#5aa14a" transform="rotate(-25 57 6)" />
  </svg>
</template>

<style scoped>
.capybara {
  display: block;
  overflow: visible;
}
</style>
