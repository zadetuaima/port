import { defineConfig } from 'vite'

export default defineConfig({
  optimizeDeps: {
    include: ['three']
  },
  server: {
    fs: {
      allow: ['..']
    }
  }
})
