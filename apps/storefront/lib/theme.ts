export const STOREFRONT_THEME_STORAGE_KEY = "cloudbridge-storefront-theme";

export type StorefrontTheme = "dark" | "light";

export const DEFAULT_STOREFRONT_THEME: StorefrontTheme = "dark";

export const normalizeStorefrontTheme = (value: unknown): StorefrontTheme => (
  value === "light" ? "light" : DEFAULT_STOREFRONT_THEME
);

export const getNextStorefrontTheme = (
  theme: StorefrontTheme,
): StorefrontTheme => (theme === "dark" ? "light" : "dark");
