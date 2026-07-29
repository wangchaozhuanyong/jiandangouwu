import type { StorefrontHero } from "./content.js";
import type { StorefrontSettings } from "./settings.js";
import type { StorefrontChannel } from "./support.js";

export type StorefrontCurrency = {
  code: string;
  token: string;
  name: string;
  digits: number;
};

export type StorefrontConfig = {
  heroes: StorefrontHero[];
  currencies: StorefrontCurrency[];
  channels: StorefrontChannel[];
  settings: StorefrontSettings;
};
