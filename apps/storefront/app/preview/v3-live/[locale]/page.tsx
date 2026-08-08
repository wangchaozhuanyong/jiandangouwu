import { notFound } from "next/navigation";
import { V3LiveCatalogPilot } from "../../../../components/v3-live/v3-live-pilot";
import { getV2CatalogData } from "../../../../lib/api";
import { isLocale } from "../../../../lib/copy";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  try {
    const data = await getV2CatalogData({ locale, currency: "CNY", surface: "HOME" });
    return <V3LiveCatalogPilot banners={data.banners} categories={data.categories} locale={locale} products={data.products} surface="HOME" />;
  } catch {
    return <V3LiveCatalogPilot banners={[]} categories={[]} locale={locale} products={[]} surface="HOME" />;
  }
}
