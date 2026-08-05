import { notFound } from "next/navigation";
import { V2PreviewProductDetail } from "../../../../../../components/v2-preview/preview-pages";
import { isLocale } from "../../../../../../lib/copy";

export default async function PreviewV2ProductDetailPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  return <V2PreviewProductDetail locale={locale} slug={slug.slice(0, 100)} />;
}
