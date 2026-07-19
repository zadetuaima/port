import { defineConfig } from 'vite'

export default defineConfig({
  optimizeDeps: {
    include: ['three', 'pdfjs-dist']
  },
  server: {
    fs: {
      allow: ['..']
    }
  }
})
