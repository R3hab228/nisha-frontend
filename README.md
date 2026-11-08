# ⚡ NISHA STORE — Frontend & Progressive Web App (PWA)

[![Frontend Integrity Check](https://github.com/R3hab228/nisha-frontend/actions/workflows/lint.yml/badge.svg)](https://github.com/R3hab228/nisha-frontend/actions/workflows/lint.yml)
[![Website](https://img.shields.io/badge/Website-nisha--store.shop-black?logo=googlechrome&logoColor=white)](https://nisha-store.shop)
[![Security Policy](https://img.shields.io/badge/Security-Policy%20Active-green.svg)](https://github.com/R3hab228/nisha-frontend/security/policy)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?logo=pwa&logoColor=white)](https://nisha-store.shop)
[![Tests](https://img.shields.io/badge/Vitest-363%20Passing-729B1B?logo=vitest&logoColor=white)](https://vitest.dev/)

> Современный, высокоскоростной PWA-клиент для магазина **[nisha-store.shop](https://nisha-store.shop)**. Построен на модульной ES-архитектуре с аппаратным ускорением анимаций, офлайн-кэшированием, защитой от XSS и оптимизацией Core Web Vitals (LCP < 2.5s).

---

## 🎨 Особенности и возможности

- **PWA Standalone:** Установка на iOS и Android как нативное приложение, кастомный Pull-to-Refresh, Web Push уведомления.
- **Модульная архитектура:** Разделение на независимые подсистемы (`catalog`, `cart`, `product`, `profile`, `chat`, `orders`).
- **XSS Shield:** Санитизация пользовательского контента через `DOMPurify` и `escapeHtml` (вопросы к товарам, чат, отзывы).
- **Core Web Vitals:** Lazy loading изображений, отзывчивый скролл (Lenis), предиктивный поиск через Web Worker (Fuse.js).
- **Интернационализация:** Мультиязычность через i18next (украинский / русский).

---

## 🛠️ Скрипты разработки

```bash
# Локальный сервер разработки (Vite)
npm run dev

# Продакшен-сборка
npm run build

# Запуск тестов (Vitest)
npm test

# Проверка качества кода (ESLint)
npm run lint
```
