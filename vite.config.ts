import { defineConfig } from 'vite';
export default defineConfig({ base: './', cacheDir:'./.vite-cache', build: { target: 'es2022', assetsInlineLimit: 4096, rollupOptions:{output:{manualChunks:{phaser:['phaser']}}} } });
