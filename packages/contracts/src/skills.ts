import type { LocalizedText } from "./common.js";

export const skillResourceTypes = ["SKILL", "PLUGIN", "CONNECTOR"] as const;
export type SkillResourceType = (typeof skillResourceTypes)[number];

export const skillSourceLevels = ["OFFICIAL", "COMMUNITY"] as const;
export type SkillSourceLevel = (typeof skillSourceLevels)[number];

export type SkillCategorySummary = {
  id: string;
  slug: string;
  name: string;
  order: number;
};

export type SkillSummary = {
  id: string;
  slug: string;
  categoryId: string;
  category: SkillCategorySummary;
  name: string;
  summary: string;
  resourceType: SkillResourceType;
  sourceLevel: SkillSourceLevel;
  maintainer: string;
  githubUrl: string;
  compatibleEnvironments: string[];
  verifiedAt: string;
};

export type SkillDetail = SkillSummary & {
  description: string;
  suitableFor: string[];
  unsuitableFor: string[];
  installHint: string;
  documentationUrl: string | null;
  license: string;
};

export type AdminSkillTranslation = {
  name: string;
  summary: string;
  description: string;
  suitableFor: string[];
  unsuitableFor: string[];
  installHint: string;
};

export type AdminSkillTranslations = Readonly<Record<keyof LocalizedText, AdminSkillTranslation>>;
