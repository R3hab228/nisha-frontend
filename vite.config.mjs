import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        returnPolicy: resolve(import.meta.dirname, 'return-policy.html'),
        notFound: resolve(import.meta.dirname, '404.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('i18next')) return 'vendor-i18n';
            if (id.includes('photoswipe')) return 'feature-photoswipe';
            if (id.includes('driver.js')) return 'feature-driver';
            if (id.includes('sortablejs')) return 'feature-sortable';
            if (id.includes('jsbarcode')) return 'feature-jsbarcode';
            if (id.includes('auto-animate')) return 'feature-autoanimate';
            if (id.includes('vanilla-tilt')) return 'feature-tilt';
            if (id.includes('lenis') || id.includes('dompurify') || id.includes('fuse.js') || id.includes('imask')) return 'vendor-libs';
            return 'vendor';
          }
        },
      },
    },
  },
  server: {
    port: 3000,
  },
});
