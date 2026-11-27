// Ambient type declarations for NISHA Store browser globals & legacy window facades
export {};

declare global {
    interface Window {
        allItems?: any[];
        filteredItems?: any[];
        renderedCount?: number;
        cart?: any[];
        favorites?: any[];
        currentUser?: any;
        userProfile?: any;
        store?: any;
        appStore?: any;
        storage?: any;
        safeStorage?: any;
        _supabase?: any;
        isHacked?: boolean;
        otpVerified?: boolean;
        currentPromoDiscount?: number;
        appliedPromoCode?: string;
        currentPromoFixed?: number | null;
        selectedCityRef?: string;
        selectedBranchRef?: string;
        selectedSettlementRef?: string;
        currentOpenedItem?: any;
        clientFingerprint?: string | null;
        i18next?: any;
        apiClient?: any;
        lenis?: any;
        turnstile?: any;
        analytics?: any;
        Telegram?: any;
        Sentry?: any;
        plausible?: any;
        posthog?: any;
        clarity?: any;
        ttq?: any;
        [key: string]: any;
    }

    interface Document {
        [key: string]: any;
    }

    interface Navigator {
        userAgentData?: {
            platform?: string;
            mobile?: boolean;
            brands?: Array<{ brand: string; version: string }>;
        };
        standalone?: boolean;
        connection?: any;
        deviceMemory?: number;
        getBattery?: () => Promise<any>;
    }

    // Build-time Vite defines & third-party SDK globals
    var __SENTRY_RELEASE__: string | undefined;
    var i18next: any;
    var DOMPurify: any;
    var CONFIG: any;
    var Sentry: any;
    var PhotoSwipe: any;
    var Sortable: any;
    var IMask: any;
    var JsBarcode: any;
    var Fuse: any;
    var Lenis: any;
    var VanillaTilt: any;
    var autoAnimate: any;
    var driver: any;
    var supabase: any;
    var turnstile: any;

    // Shared runtime state globals
    var storage: any;
    var safeStorage: any;
    var store: any;
    var apiClient: any;
    var _supabase: any;
    var currentUser: any;
    var userProfile: any;
    var allItems: any[];
    var filteredItems: any[];
    var cart: any[];
    var favorites: any[];
    var clientFingerprint: string | null;
    var isHacked: boolean;

    // Core helper & facade functions exposed on globalThis / window
    var getCurrency: () => string;
    var formatPrice: (price: any, options?: { currencyOnly?: boolean; numberOnly?: boolean; forceUah?: boolean }) => string;
    var deepClone: <T>(val: T) => T;
    var hasOwn: (obj: any, key: PropertyKey) => boolean;
    var escapeHtml: (val: any) => string;
    var escapeAttr: (val: any) => string;
    var sanitizeHtmlMediaUrl: (url: any) => string;
    var toCDN: (url: any, opts?: any) => string;
    var getOptimizedImg: (item: any, idx?: number) => string;
    var triggerHaptic: (type?: string) => void;
    var playSound: (name: string, opts?: any) => void;
    var sleep: (ms: number) => Promise<void>;
    var clamp: (val: number, min: number, max: number) => number;
    var showToast: (msg: string, type?: string, imgUrl?: string | null, onClick?: (() => void) | null) => void;
    var showTerminalModal: (title: string, msg: string, btnText?: string, onAction?: (() => void) | null, opts?: any) => void;
    var showTerminalConfirm: (title: string, msg: string, opts?: any) => Promise<boolean>;
    var showTerminalPrompt: (title: string, msg: string, defaultVal?: string, opts?: any) => Promise<string | null>;
    var openModal: (id: string, opts?: any) => void;
    var closeModal: (id: string, opts?: any) => void;
    var executeCloseModal: (id: string, opts?: any) => void;
    var safeViewTransition: (cb: () => any) => any;
    var triggerModalTypewriter: (target: any) => void;
    var updateCartUI: () => void;
    var renderCartItems: () => void;
    var getActiveCart: () => any[];
    var syncCartToServer: () => Promise<any>;
    var applyFilters: (resetPage?: boolean) => void;
    var checkSession: () => Promise<void>;
    var updateProposeAndCheckoutFields: () => void;
    var initTurnstileWidgets: () => void;
    var handleNetworkOffline: () => void;
    var getUserDisplayName: (user: any, profile?: any) => string;
    var normalizeSiteLang: (lang: any) => 'ua' | 'ru' | 'en';
    var updateFooterLanguageUI: (lang: any) => void;
    var changeLanguage: (lang: any) => Promise<void>;
    var updateContentLanguage: () => void;
    var safeEncodeURIComponent: (str: any) => string;
    var toWellFormed: (str: any) => string;
    var canParseURL: (url: string, base?: string) => boolean;
    var ensurePhotoSwipe: () => Promise<any>;
    var renderHistory: () => void;
    var loadExternalScript: (src: string, opts?: any) => Promise<any>;
    var formatPhoneInput: (inputEl: any, rawValue?: string) => string;
    var isUserInProductFeed: () => boolean;
    var itemMatchesPrice: (item: any, query: any) => boolean;
    var parsePriceSearchQuery: (query: any) => any;
    var expandSearchQuery: (query: any) => any;
    var openProfileModal: () => void;
    var openProductModalById: (id: any, opts?: any) => any;
    var checkPendingBargainNotification: (...args: any[]) => any;
    var enqueueNewItemToast: (...args: any[]) => any;
    var getCatalog: () => any[];
    var scrollNPFieldIntoModalView: (el: any) => void;
    var parseDeliveryAddress: (addr: any) => any;
    var getOrderItemImage: (item: any) => string;
    var getWin95HourglassHtml: () => string;
    var checkPhoneAuth: (...args: any[]) => any;
}
