import { redirect } from "next/navigation";
import { getConfig } from "../lib/api";

export default async function IndexPage() {
  let defaultLocale = "zh";
  try {
    const config = await getConfig("zh");
    defaultLocale = config.settings.defaultLocale;
  } catch {
    // The storefront remains reachable with its safe local default while the API is unavailable.
  }
  redirect(`/${defaultLocale}`);
}
