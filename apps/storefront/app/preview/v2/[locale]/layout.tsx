import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { V2PreviewShell } from "../../../../components/v2-preview/preview-shell";
import { getConfig } from "../../../../lib/api";
import { isLocale } from "../../../../lib/copy";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale) || process.env.NODE_ENV !== "development") return {};
  return {
    title: locale === "zh" ? "V2 界面设计预览 · CloudBridge" : "V2 interface preview · CloudBridge",
    description: locale === "zh" ? "仅本地开发环境开放的 CloudBridge V2 模拟界面。" : "A local-development-only mock interface for CloudBridge V2.",
    robots: { index: false, follow: false },
  };
}

export default async function PreviewV2LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  let config = null;
  try {
    config = await getConfig(locale);
  } catch {
    // The preview remains truthful and usable with typed local fixtures when the read-only config is unavailable.
  }
  return <V2PreviewShell initialConfig={config} locale={locale}>{children}</V2PreviewShell>;
}
