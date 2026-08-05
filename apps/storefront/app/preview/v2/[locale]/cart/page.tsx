import { notFound } from "next/navigation";
import { V2PreviewCartPage } from "../../../../../components/v2-preview/preview-pages";
import { isLocale } from "../../../../../lib/copy";

export default async function PreviewV2CartPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <V2PreviewCartPage locale={locale} />;
}
