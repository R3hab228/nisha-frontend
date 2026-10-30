import js from '@eslint/js';
import globals from 'globals';
import prettierConfig from 'eslint-config-prettier';

export default [
    {
        ignores: [
            'dist/**',
            'node_modules/**',
            '.vite/**',
            'public/**',
            'coverage/**',
            'scratch/**',
            'sw.js',
            '*.min.js'
        ],
    },
    js.configs.recommended,
    {
        files: ['**/*.js', '**/*.mjs'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.es2021,
                // App & Vendor Globals
                DOMPurify: 'readonly',
                i18next: 'readonly',
                PhotoSwipe: 'readonly',
                PhotoSwipeLightbox: 'readonly',
                driver: 'readonly',
                IMask: 'readonly',
                JsBarcode: 'readonly',
                autoAnimate: 'readonly',
                VanillaTilt: 'readonly',
                Lenis: 'readonly',
                Fuse: 'readonly',
                Sentry: 'readonly',
                ttq: 'readonly',
                clarity: 'readonly',
                Telegram: 'readonly',
                _supabase: 'readonly',
                createClient: 'readonly',
                __BUILD_ID__: 'readonly'
            },
        },
        rules: {
            // Unused variables & parameters tuning
            'no-unused-vars': [
                'warn',
                {
                    vars: 'all',
                    args: 'none',
                    caughtErrors: 'none',
                    ignoreRestSiblings: true,
                    varsIgnorePattern: '^_'
                }
            ],
            'no-useless-assignment': 'off',
            'no-empty': ['warn', { allowEmptyCatch: true }],
            'no-console': 'off',
            'no-debugger': 'warn',
            'no-prototype-builtins': 'off',
            'no-useless-escape': 'off',
            'no-undef': 'off', // Multi-module script architecture shares helpers globally
        },
    },
    {
        files: ['tests/**/*.js'],
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.browser,
                describe: 'readonly',
                it: 'readonly',
                test: 'readonly',
                expect: 'readonly',
                vi: 'readonly',
                beforeEach: 'readonly',
                afterEach: 'readonly',
                beforeAll: 'readonly',
                afterAll: 'readonly',
            },
        },
        rules: {
            'no-unused-vars': 'off',
        },
    },
    {
        files: ['vite.config.mjs', 'eslint.config.mjs'],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
    },
    prettierConfig,
];
