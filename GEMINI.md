# NISHA STORE — Project Knowledge & Memory Base

## Project Overview
- **Project**: NISHA STORE (Vintage & Archive Streetwear Marketplace)
- **Live URL**: https://www.nisha-store.shop/
- **Owner / Founder**: Максим
- **Repositories**:
  - Frontend: `C:\Users\admin\Documents\GitHub\nisha-frontend` (main branch)
  - Backend: `C:\Users\admin\Documents\GitHub\nisha-backend` (main branch)

---

## Core Tech Stack & Architecture
- **Bundler & Tooling**: Vite 8, Rollup/Rolldown, Vitest, ESLint.
- **Frontend Core**: Vanilla JS ES6+ modules with a unified modular facade (`src/modules/index.js`).
- **State Management**: Reactive state store (`js/core/store.js` and `src/modules/store.js`).
- **Database & Auth**: Supabase JS Client (`@supabase/supabase-js`).
- **Delivery Integration**: Nova Poshta API with IndexedDB caching (`js/cart/cart.js`, `tests/novaPoshtaIdbCache.test.js`).
- **Security & Bot Protection**: Cloudflare Turnstile, DOMPurify sanitization, Strict HSTS (Preload), CSP headers.
- **Internationalization (i18n)**:
  - Supported locales: `ua` (Ukrainian, default / HTML `lang="uk"`), `ru` (Russian), `en` (English).
  - Centralized utilities: `normalizeSiteLang(lang)`, `getFlagUrlByLang(lang)`, `updateFooterLanguageUI(lang)`, `detectInitialSiteLang()`.
  - Harmonized sync across `<head>` preload, footer inline script, `app.js` i18next initialization, and Supabase user profile.
  - Event listener: `i18next.on('languageChanged', ...)` ensures reactive footer updates on any dynamic language switch.

---

## Modern Standards & Optimizations (November 2026)
- **ES2024 String Sanitization**: `String.prototype.toWellFormed()` and `isWellFormed()` to prevent surrogate URIErrors.
- **ES2024 URL Parsing**: `URL.canParse()` with safe fallbacks.
- **Microfreeze-free Search**: `Intl.Segmenter` (word boundary segmentation) + Web Worker (`search.worker.js`) for instant catalog filtering.
- **PWA Features**: Standalone pull-to-refresh with haptic feedback, Service Worker cache invalidation with build IDs, Web Locks API for multi-tab leader election.

---

## Testing & Quality Gate (MUST NEVER BREAK)
1. **Tests**: Vitest suite (`npm test`). **465+ passing tests**.
2. **Linter**: ESLint (`npm run lint`). **0 errors, 0 warnings**.
3. **Build**: Vite production build (`npm run build`). Must compile cleanly in < 1 second.
4. **Git**: All validated changes are committed with semantic messages and pushed to `origin/main`.
