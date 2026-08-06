import type { LocalizedText } from "./common.js";
import type { ProductSurface } from "./catalog.js";

export const heroStatuses = ["DRAFT", "ACTIVE", "INACTIVE"] as const;
export type HeroStatus = (typeof heroStatuses)[number];

export const heroTones = ["cyan", "blue", "violet", "green"] as const;
export type HeroTone = (typeof heroTones)[number];

export const bannerPlacements = ["HOME", "TRANSIT_SUBSCRIPTIONS", "AI_RECHARGE"] as const;
export type BannerPlacement = ProductSurface;

export const bannerTargetTypes = ["NONE", "PRODUCT", "CATEGORY", "EXTERNAL_URL"] as const;
export type BannerTargetType = (typeof bannerTargetTypes)[number];

export type HeroTranslation = {
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
};

export type HeroTranslations = Readonly<Record<keyof LocalizedText, HeroTranslation>>;

export type StorefrontHero = {
  key: string;
  imageUrl: string;
  targetSlug: string | null;
  tone: HeroTone;
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  placement?: BannerPlacement;
  mobileImageUrl?: string | null;
  targetType?: BannerTargetType;
  targetValue?: string | null;
  secondaryCta?: string | null;
  secondaryTargetType?: BannerTargetType | null;
  secondaryTargetValue?: string | null;
};

export type StorefrontBanner = StorefrontHero & {
  placement: BannerPlacement;
};

export type AdminHero = {
  id: string;
  key: string;
  imageKey: string;
  targetSlug: string | null;
  placement: BannerPlacement;
  mobileImageKey: string | null;
  targetType: BannerTargetType;
  targetValue: string | null;
  secondaryCta: Readonly<Record<keyof LocalizedText, string | null>>;
  secondaryTargetType: BannerTargetType | null;
  secondaryTargetValue: string | null;
  tone: HeroTone;
  status: HeroStatus;
  sortOrder: number;
  version: number;
  translations: HeroTranslations;
  createdAt: string;
  updatedAt: string;
};

export type CreateHeroInput = {
  key: string;
  imageKey: string;
  targetSlug: string | null;
  placement?: BannerPlacement;
  mobileImageKey?: string | null;
  targetType?: BannerTargetType;
  targetValue?: string | null;
  secondaryCta?: Readonly<Record<keyof LocalizedText, string | null>>;
  secondaryTargetType?: BannerTargetType | null;
  secondaryTargetValue?: string | null;
  tone: HeroTone;
  status: HeroStatus;
  sortOrder: number;
  translations: HeroTranslations;
};

export type UpdateHeroInput = CreateHeroInput & {
  version: number;
};

export type ReorderHeroesInput = {
  items: ReadonlyArray<{
    id: string;
    version: number;
  }>;
};
