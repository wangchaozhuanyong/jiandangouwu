import { notFound } from "next/navigation";
import { SiteShell } from "../../components/site-shell";
import { isLocale } from "../../lib/copy";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <SiteShell locale={locale}>{children}</SiteShell>;
}
