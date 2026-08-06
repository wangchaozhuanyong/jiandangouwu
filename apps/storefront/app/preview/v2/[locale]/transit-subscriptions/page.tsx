import { notFound } from "next/navigation";
import { V2PreviewMarketPage } from "../../../../../components/v2-preview/preview-pages";
import { isLocale } from "../../../../../lib/copy";

export default async function PreviewV2TransitPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <V2PreviewMarketPage locale={locale} surface="TRANSIT_SUBSCRIPTIONS" />;
}
