import { notFound } from "next/navigation";
import { V3CartFinal } from "../../../../../components/v3-preview/v3-final-pages";
import { isLocale } from "../../../../../lib/copy";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <V3CartFinal locale={locale} />;
}
