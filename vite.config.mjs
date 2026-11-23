import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { sentryVitePlugin } from '@sentry/vite-plugin';

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
const SENTRY_RELEASE = `nisha-store@${COMMIT_HASH}`;

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
            return res.end(src.replaceAll('__BUILD_ID__', BUILD_ID));
          }
        }
        next();
      });
    },
    closeBundle() {
      const swDistPath = resolve(import.meta.dirname, 'dist', 'sw.js');
      if (existsSync(swDistPath)) {
        const src = readFileSync(swDistPath, 'utf8');
        writeFileSync(swDistPath, src.replaceAll('__BUILD_ID__', BUILD_ID));
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

// Безопасная минификация HTML в production-сборке:
// сохраняет <script>, <style>, <textarea>, <pre> и пробелы между inline-тегами на одной строке,
// сжимает JSON-LD/speculationrules, комментарии и межстрочные отступы.
function minifyHtmlPlugin() {
  return {
    name: 'nisha-minify-html',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const preserved = [];
        const mask = (chunk) => {
          const token = `__NISHA_HTML_PRESERVE_${preserved.length}__`;
          preserved.push(chunk);
          return token;
        };

        let out = html.replace(
          /<(script|style|textarea|pre)(\b[^>]*)>([\s\S]*?)<\/\1>/gi,
          (full, tag, attrs, inner) => {
            if (/^script$/i.test(tag) && /type\s*=\s*["']?(?:application\/ld\+json|speculationrules)["']?/i.test(attrs)) {
              try {
                const compactJson = JSON.stringify(JSON.parse(inner));
                return mask(`<${tag}${attrs}>${compactJson}</${tag}>`);
              } catch {
                return mask(full);
              }
            }
            return mask(full);
          }
        );

        // Strip non-conditional HTML comments
        out = out.replace(/<!--(?!\[if)[\s\S]*?-->/g, '');
        // Trim per-line indentation and drop blank lines
        out = out.replace(/^[ \t]+|[ \t]+$/gm, '');
        // Collapse newline-separated tag boundaries while preserving same-line inline spaces
        out = out.replace(/>\s*\r?\n+\s*</g, '><');
        out = out.replace(/\r?\n+/g, '\n');

        // Restore protected blocks
        out = out.replace(/__NISHA_HTML_PRESERVE_(\d+)__/g, (_, idx) => preserved[Number(idx)] ?? '');
        return out.trim();
      },
    },
  };
}

export default defineConfig({
  publicDir: 'public',
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
      '@modules': resolve(import.meta.dirname, 'src/modules'),
    },
  },
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
    __SENTRY_RELEASE__: JSON.stringify(SENTRY_RELEASE),
  },
  plugins: [
    swBuildIdPlugin(),
    minifyHtmlPlugin(),
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG || 'nisha-store-6w',
            project: process.env.SENTRY_PROJECT || 'node',
            authToken: process.env.SENTRY_AUTH_TOKEN,
            release: { name: SENTRY_RELEASE },
            sourcemaps: {
              filesToDeleteAfterUpload: ['./dist/**/*.map'],
            },
            telemetry: false,
          }),
        ]
      : []),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: process.env.SENTRY_AUTH_TOKEN ? 'hidden' : false,
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
            if (id.includes('lenis')) return 'feature-lenis';
            if (id.includes('fuse.js')) return 'feature-fuse';
            if (id.includes('imask')) return 'feature-imask';
            if (id.includes('dompurify')) return 'vendor-dompurify';
            return 'vendor';
          }
          if (id.includes('/js/core/sound-effects') || id.includes('\\js\\core\\sound-effects')) {
            return 'app-sound';
          }
          if (id.includes('/js/core/') || id.includes('\\js\\core\\')) {
            return 'app-core';
          }
          if (id.includes('/js/catalog/') || id.includes('\\js\\catalog\\')) {
            return 'app-catalog';
          }
          if (
            id.includes('/js/cart/checkout-') || id.includes('\\js\\cart\\checkout-') ||
            id.includes('/js/cart/novaposhta-delivery') || id.includes('\\js\\cart\\novaposhta-delivery') ||
            id.includes('/js/cart/novaposhta-city-detect') || id.includes('\\js\\cart\\novaposhta-city-detect') ||
            id.includes('/js/cart/npCacheStorage') || id.includes('\\js\\cart\\npCacheStorage')
          ) {
            return 'app-checkout';
          }
          if (id.includes('/js/cart/') || id.includes('\\js\\cart\\')) {
            return 'app-cart';
          }
          if (id.includes('/js/product/') || id.includes('\\js\\product\\')) {
            return 'app-product';
          }
          if (
            id.includes('/js/profile/profile-modal-bundle') || id.includes('\\js\\profile\\profile-modal-bundle') ||
            id.includes('/js/profile/profile-contacts') || id.includes('\\js\\profile\\profile-contacts') ||
            id.includes('/js/profile/profile-delivery') || id.includes('\\js\\profile\\profile-delivery') ||
            id.includes('/js/profile/profile-np-delivery') || id.includes('\\js\\profile\\profile-np-delivery')
          ) {
            return 'app-profile-modal';
          }
          if (id.includes('/js/profile/') || id.includes('\\js\\profile\\') || id.includes('/js/auth/') || id.includes('\\js\\auth\\')) {
            return 'app-profile';
          }
          if (id.includes('/js/ui/') || id.includes('\\js\\ui\\')) {
            return 'app-ui';
          }
        },
      },
    },
  },
  server: {
    port: 3000,
  },
  test: {
    include: ['tests/**/*.test.js'],
    setupFiles: ['./tests/setup.js'],
  },
});
