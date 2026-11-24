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
        [key: string]: any;
    }

    var i18next: any;
    var getCurrency: (() => string) | undefined;
    var formatPrice: ((price: any) => string) | undefined;
    var deepClone: (<T>(val: T) => T) | undefined;
    var showToast: ((msg: string, type?: string, imgUrl?: string | null, onClick?: (() => void) | null) => void) | undefined;
}
