import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [vue()],
  resolve: { dedupe: ['vue', 'element-plus', 'vue-color'] },
})
