// src/config/settingsKeys.ts

// --- Price Settings for Ads (used in AdminAdvertisingSettingsSection and AdvertisingSection) ---
export const AD_SMM_POST_PRICE_KEY = 'AD_SMM_POST_PRICE';
export const AD_SMM_PIN_DAY_PRICE_KEY = 'AD_SMM_PIN_DAY_PRICE';
export const AD_ONSITE_WEEK_PRICE_KEY = 'AD_ONSITE_WEEK_PRICE';
export const AD_ONSITE_MONTH_PRICE_KEY = 'AD_ONSITE_MONTH_PRICE';

export const ALL_AD_PRICE_SETTINGS_KEYS = [ // Renamed for clarity
    AD_SMM_POST_PRICE_KEY,
    AD_SMM_PIN_DAY_PRICE_KEY,
    AD_ONSITE_WEEK_PRICE_KEY,
    AD_ONSITE_MONTH_PRICE_KEY,
];

export const DEFAULT_AD_PRICES: Record<string, string> = {
    [AD_SMM_POST_PRICE_KEY]: "500",
    [AD_SMM_PIN_DAY_PRICE_KEY]: "1000",
    [AD_ONSITE_WEEK_PRICE_KEY]: "700",
    [AD_ONSITE_MONTH_PRICE_KEY]: "2500",
};

export const AD_PRICE_SETTINGS_LABELS: Record<string, string> = { // Renamed for clarity
    [AD_SMM_POST_PRICE_KEY]: "Стоимость размещения SMM поста (руб.):",
    [AD_SMM_PIN_DAY_PRICE_KEY]: "Стоимость закрепления SMM поста на 1 день (руб.):",
    [AD_ONSITE_WEEK_PRICE_KEY]: "Стоимость рекламы на сайте на 1 неделю (руб.):",
    [AD_ONSITE_MONTH_PRICE_KEY]: "Стоимость рекламы на сайте на 1 месяц (руб.):",
};

// --- Content Settings for On-Site Ad (used in AdminOnSiteAdManagementSection and DashboardLayout) ---
export const ONSITE_AD_TITLE_KEY = 'ONSITE_AD_TITLE';
export const ONSITE_AD_DESCRIPTION_KEY = 'ONSITE_AD_DESCRIPTION';
export const ONSITE_AD_URL_KEY = 'ONSITE_AD_URL';
export const ONSITE_AD_ACTIVE_KEY = 'ONSITE_AD_ACTIVE';

export const ALL_ONSITE_AD_CONTENT_KEYS = [
    ONSITE_AD_TITLE_KEY,
    ONSITE_AD_DESCRIPTION_KEY,
    ONSITE_AD_URL_KEY,
    ONSITE_AD_ACTIVE_KEY,
];

export const DEFAULT_ONSITE_AD_CONTENT: Record<string, string> = {
    [ONSITE_AD_TITLE_KEY]: "Продвигайте свой проект!",
    [ONSITE_AD_DESCRIPTION_KEY]: "Разместите рекламу вашего продукта на нашем сайте.",
    [ONSITE_AD_URL_KEY]: "#", // Default link can go to advertising info or contact
    [ONSITE_AD_ACTIVE_KEY]: "true", // 'true' or 'false' as string for DB consistency
};

export const ONSITE_AD_CONTENT_LABELS: Record<string, string> = {
    [ONSITE_AD_TITLE_KEY]: "Заголовок рекламы на сайте:",
    [ONSITE_AD_DESCRIPTION_KEY]: "Описание рекламы на сайте (1 предложение):",
    [ONSITE_AD_URL_KEY]: "URL-ссылка рекламы на сайте:",
    [ONSITE_AD_ACTIVE_KEY]: "Реклама на сайте активна:",
};

// --- Site Statistics Keys ---
export const TOTAL_AD_CLICKS_KEY = 'TOTAL_AD_CLICKS';

export const ALL_STATISTICS_KEYS = [ // For fetching specific stat-related settings
    TOTAL_AD_CLICKS_KEY,
];

export const DEFAULT_STATISTICS_VALUES: Record<string, string> = {
    [TOTAL_AD_CLICKS_KEY]: "0",
};

// Combine all keys that might be fetched from app_settings for convenience in some places if needed
export const ALL_APP_SETTINGS_KEYS = [
    ...ALL_AD_PRICE_SETTINGS_KEYS,
    ...ALL_ONSITE_AD_CONTENT_KEYS,
    ...ALL_STATISTICS_KEYS,
];