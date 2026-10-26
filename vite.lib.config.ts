import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: 'dist',
    lib: {
      entry: './src/index.ts',
      name: 'ColorPickerLib',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: ['vue', 'element-plus', 'vue-color', 'vue-color/style.css', '@zumer/snapdom', 'mitt', 'uuid'],
      output: { assetFileNames: 'assets/[name].[ext]' },
    },
  },
})
