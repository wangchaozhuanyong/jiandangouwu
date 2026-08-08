import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { V3LivePilotShell } from "../../../../components/v3-live/v3-live-pilot";
import { getConfig } from "../../../../lib/api";
import { isLocale } from "../../../../lib/copy";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale) || process.env.NODE_ENV !== "development") return {};
  return {
    title: locale === "zh" ? "V3 Live Data Pilot · CloudBridge" : "V3 Live Data Pilot · CloudBridge",
    description: locale === "zh" ? "V3 读取真实 Storefront API 的开发迁移预览。" : "Development migration preview using the live Storefront API contract.",
    robots: { index: false, follow: false },
  };
}

export default async function V3LivePilotLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  let config = null;
  try {
    config = await getConfig(locale);
  } catch {
    // The pilot remains readable with a safe local shell if config is temporarily unavailable.
  }
  return <V3LivePilotShell config={config} locale={locale}>{children}</V3LivePilotShell>;
}
