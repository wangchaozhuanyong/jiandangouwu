import { notFound } from "next/navigation";
import { V2LiveCatalogPage } from "../../components/v2-live/live-catalog";
import { getV2CatalogData } from "../../lib/api";
import { isLocale } from "../../lib/copy";

export const dynamic = "force-dynamic";

export default async function HomePage({
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
      surface: "HOME",
    });
    return (
      <V2LiveCatalogPage
        banners={data.banners}
        categories={data.categories}
        config={data.config}
        initialProducts={data.products}
        locale={locale}
        surface="HOME"
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
        surface="HOME"
      />
    );
  }
}
