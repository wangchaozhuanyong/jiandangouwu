import type { LocalizedText } from "./common.js";

export const heroStatuses = ["DRAFT", "ACTIVE", "INACTIVE"] as const;
export type HeroStatus = (typeof heroStatuses)[number];

export const heroTones = ["cyan", "blue", "violet", "green"] as const;
export type HeroTone = (typeof heroTones)[number];

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
};

export type AdminHero = {
  id: string;
  key: string;
  imageKey: string;
  targetSlug: string | null;
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
