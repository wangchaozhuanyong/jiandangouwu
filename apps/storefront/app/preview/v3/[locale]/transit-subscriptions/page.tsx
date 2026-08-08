import { notFound } from "next/navigation";
import { V3Transit } from "../../../../../components/v3-preview/v3-pages";
import { isLocale } from "../../../../../lib/copy";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <V3Transit locale={locale} />;
}
