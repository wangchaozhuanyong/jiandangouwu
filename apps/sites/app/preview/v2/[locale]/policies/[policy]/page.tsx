import { notFound } from "next/navigation";
import { V2PreviewPolicy } from "../../../../../../../storefront/components/v2-preview/preview-pages";
import { isLocale } from "../../../../../../../storefront/lib/copy";

export default async function SitesPreviewV2PolicyPage({ params }: { params: Promise<{ locale: string; policy: string }> }) {
  const { locale, policy } = await params;
  if (!isLocale(locale) || (policy !== "terms" && policy !== "privacy")) notFound();
  return <V2PreviewPolicy locale={locale} policy={policy} />;
}
