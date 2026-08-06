import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { V2LiveOrderLookup } from "../../../../components/v2-live/live-commerce";
import { isLocale } from "../../../../lib/copy";

export const metadata: Metadata = {
  title: "Order lookup",
  robots: { index: false, follow: false },
};

export default async function OrderLookupPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <V2LiveOrderLookup locale={locale} />;
}
