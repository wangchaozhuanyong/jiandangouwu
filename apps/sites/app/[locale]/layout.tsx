import { notFound } from "next/navigation";
import { SiteShell } from "../../../storefront/components/site-shell";
import { isLocale } from "../../../storefront/lib/copy";

export const dynamic = "force-dynamic";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <SiteShell locale={locale} initialConfig={null}>{children}</SiteShell>;
}
