import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { V3LiveOrderLookupPilot } from "../../../../../../components/v3-live/v3-live-secondary";
import { isLocale } from "../../../../../../lib/copy";

export const metadata: Metadata = {
  title: "V3 Live Order Lookup Pilot",
  robots: { index: false, follow: false },
};

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <V3LiveOrderLookupPilot locale={locale} />;
}
