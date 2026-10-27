import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

function resolveCommitHash() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 8);
  }
  if (process.env.GITHUB_SHA) {
    return process.env.GITHUB_SHA.slice(0, 8);
  }
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().slice(0, 8);
  } catch {
    return 'build';
  }
}

// Уникальный ID каждой сборки: сочетает git-хеш коммита и таймстемп сборки.
// Гарантирует, что URL и имя кэша Service Worker обновляются автоматически при каждом деплое
// и всегда прослеживаются до конкретного коммита.
const COMMIT_HASH = resolveCommitHash() || 'build';
const BUILD_ID = `${COMMIT_HASH}-${Date.now().toString(36)}`;

// Подставляет BUILD_ID в готовый dist/sw.js и синхронизирует корневой sw.js
function swBuildIdPlugin() {
  return {
    name: 'nisha-sw-build-id',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const cleanUrl = (req.url || '').split('?')[0];
        if (cleanUrl === '/sw.js') {
          const swPath = resolve(import.meta.dirname, 'public', 'sw.js');
          if (existsSync(swPath)) {
            const src = readFileSync(swPath, 'utf8');
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            return res.end(src.split('__BUILD_ID__').join(BUILD_ID));
          }
        }
        next();
      });
    },
    closeBundle() {
      const swDistPath = resolve(import.meta.dirname, 'dist', 'sw.js');
      if (existsSync(swDistPath)) {
        const src = readFileSync(swDistPath, 'utf8');
        writeFileSync(swDistPath, src.split('__BUILD_ID__').join(BUILD_ID));
      }
      const swRootPath = resolve(import.meta.dirname, 'sw.js');
      const swPublicPath = resolve(import.meta.dirname, 'public', 'sw.js');
      if (existsSync(swPublicPath)) {
        const publicSrc = readFileSync(swPublicPath, 'utf8');
        writeFileSync(swRootPath, publicSrc);
      }
    },
  };
}

export default defineConfig({
  publicDir: 'public',
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  plugins: [swBuildIdPlugin()],
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
