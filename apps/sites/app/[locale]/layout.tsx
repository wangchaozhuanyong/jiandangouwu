import { notFound } from "next/navigation";
import { SiteShell } from "../../../storefront/components/site-shell";
import { isLocale } from "../../../storefront/lib/copy";
import { readStorefrontBootstrap } from "../read-storefront-bootstrap";

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
  const bootstrap = await readStorefrontBootstrap();
  const initialConfig = bootstrap?.locale === locale
    ? bootstrap.data.config
    : null;
  return <SiteShell locale={locale} initialConfig={initialConfig}>{children}</SiteShell>;
}
