import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { V2LiveCatalogPage } from "../../../components/v2-live/live-catalog";
import { getV2CatalogData } from "../../../lib/api";
import { isLocale } from "../../../lib/copy";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Transit subscriptions" };

export default async function TransitSubscriptionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  try {
    const data = await getV2CatalogData({
      locale,
      currency: "CNY",
      surface: "TRANSIT_SUBSCRIPTIONS",
    });
    return (
      <V2LiveCatalogPage
        banners={data.banners}
        categories={data.categories}
        config={data.config}
        initialProducts={data.products}
        locale={locale}
        surface="TRANSIT_SUBSCRIPTIONS"
      />
    );
  } catch {
    return (
      <V2LiveCatalogPage
        banners={[]}
        categories={[]}
        config={null}
        initialProducts={[]}
        locale={locale}
        surface="TRANSIT_SUBSCRIPTIONS"
      />
    );
  }
}
