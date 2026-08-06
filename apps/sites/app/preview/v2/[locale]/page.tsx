import { notFound } from "next/navigation";
import { V2PreviewHome } from "../../../../../storefront/components/v2-preview/preview-pages";
import { isLocale } from "../../../../../storefront/lib/copy";

export default async function SitesPreviewV2HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <V2PreviewHome locale={locale} />;
}
