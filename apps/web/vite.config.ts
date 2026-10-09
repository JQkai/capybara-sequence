import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  // 部署到子路徑（例如 GitHub Pages）時也能正確載入資源
  base: './',
});
