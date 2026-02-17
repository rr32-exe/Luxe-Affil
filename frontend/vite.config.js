import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'index.html',
        article: 'article.html',
        category: 'category.html',
        admin: 'admin.html',
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:8787',
      '/go': 'http://localhost:8787',
    },
  },
});
