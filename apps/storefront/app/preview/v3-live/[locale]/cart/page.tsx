import { notFound } from "next/navigation";
import { V3LiveCartPilot } from "../../../../../components/v3-live/v3-live-pilot";
import { isLocale } from "../../../../../lib/copy";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <V3LiveCartPilot locale={locale} />;
}
