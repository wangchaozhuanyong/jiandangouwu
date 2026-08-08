import { notFound } from "next/navigation";
import { V3ProductDetailFinal } from "../../../../../../components/v3-preview/v3-final-pages";
import { isLocale } from "../../../../../../lib/copy";

export default async function Page({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  return <V3ProductDetailFinal locale={locale} slug={slug} />;
}
