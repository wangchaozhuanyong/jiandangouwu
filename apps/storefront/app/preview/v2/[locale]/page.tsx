import { notFound } from "next/navigation";
import { V2PreviewHome } from "../../../../components/v2-preview/preview-pages";
import { isLocale } from "../../../../lib/copy";

export default async function PreviewV2HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <V2PreviewHome locale={locale} />;
}
