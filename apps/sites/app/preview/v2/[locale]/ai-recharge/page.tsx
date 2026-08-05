import { notFound } from "next/navigation";
import { V2PreviewMarketPage } from "../../../../../../storefront/components/v2-preview/preview-pages";
import { isLocale } from "../../../../../../storefront/lib/copy";

export default async function SitesPreviewV2AiRechargePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <V2PreviewMarketPage locale={locale} surface="AI_RECHARGE" />;
}
