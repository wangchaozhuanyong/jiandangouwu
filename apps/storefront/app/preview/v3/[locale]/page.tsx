import { notFound } from "next/navigation";
import { V3PreviewHome } from "../../../../components/v3-preview/v3-home";
import { isLocale } from "../../../../lib/copy";

export default async function PreviewV3HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale) || process.env.NODE_ENV !== "development") notFound();
  return <V3PreviewHome locale={locale} />;
}
