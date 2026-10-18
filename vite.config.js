import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5180, strictPort: true, proxy: { '/api': 'http://localhost:8787', '/meta': 'http://localhost:8787', '/art': 'http://localhost:8787', '/img': 'http://localhost:8787' } },
  build: { target: 'es2022' },
});
