<script setup lang="ts">
defineProps<{ disabled: boolean; canSubmit: boolean }>();
const emit = defineEmits<{ digit: [value: string]; erase: []; submit: [] }>();

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
</script>

<template>
  <div class="pad" role="group" aria-label="數字鍵盤">
    <button v-for="d in DIGITS" :key="d" type="button" class="key" :disabled="disabled" @click="emit('digit', d)">
      {{ d }}
    </button>
    <button type="button" class="key erase" :disabled="disabled" aria-label="刪除" @click="emit('erase')">⌫</button>
    <button type="button" class="key" :disabled="disabled" @click="emit('digit', '0')">0</button>
    <button type="button" class="key ok" :disabled="disabled || !canSubmit" @click="emit('submit')">確定</button>
  </div>
</template>

<style scoped>
.pad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  max-width: 320px;
  margin: 0 auto;
}

.key {
  min-height: 60px;
  border: 2px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
  font-size: 1.6rem;
  font-weight: 700;
  box-shadow: var(--shadow);
}

.key:active:not(:disabled) {
  transform: translateY(2px);
  box-shadow: none;
}

.key:disabled {
  opacity: 0.45;
}

.erase {
  color: var(--text-soft);
}

.ok {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
  font-size: 1.2rem;
}
</style>
