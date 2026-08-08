import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { V3ExperienceShell } from "../../../../components/v3-preview/v3-experience-shell";
import { isLocale } from "../../../../lib/copy";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale) || process.env.NODE_ENV !== "development") return {};
  return {
    title: locale === "zh" ? "V3 概念预览 · CloudBridge" : "V3 concept preview · CloudBridge",
    description: locale === "zh" ? "CloudBridge 下一代智能数字商城概念预览。" : "CloudBridge next-generation intelligent commerce concept preview.",
    robots: { index: false, follow: false },
  };
}

export default async function PreviewV3LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <V3ExperienceShell locale={locale}>{children}</V3ExperienceShell>;
}
