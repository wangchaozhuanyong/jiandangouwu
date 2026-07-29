import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteShell } from "../../components/site-shell";
import { getConfig } from "../../lib/api";
import { isLocale } from "../../lib/copy";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  try {
    const config = await getConfig(locale);
    return {
      title: {
        absolute: config.settings.siteName[locale],
      },
      description: config.settings.seoDescription[locale],
    };
  } catch {
    return {};
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  let config = null;
  try {
    config = await getConfig(locale);
  } catch {
    // Keep the shell available with safe local defaults if configuration is temporarily unavailable.
  }
  return <SiteShell locale={locale} initialConfig={config}>{children}</SiteShell>;
}
