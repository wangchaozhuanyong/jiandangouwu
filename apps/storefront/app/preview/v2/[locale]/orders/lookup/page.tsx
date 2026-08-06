import { notFound } from "next/navigation";
import { V2PreviewOrderLookup } from "../../../../../../components/v2-preview/preview-pages";
import { isLocale } from "../../../../../../lib/copy";

export default async function PreviewV2OrderLookupPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <V2PreviewOrderLookup locale={locale} />;
}
