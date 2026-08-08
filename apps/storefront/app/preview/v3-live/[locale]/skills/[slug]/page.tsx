import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { V3LiveSkillDetailPilot } from "../../../../../../components/v3-live/v3-live-secondary";
import { ApiRequestError, getSkill } from "../../../../../../lib/api";
import { isLocale } from "../../../../../../lib/copy";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale) || process.env.NODE_ENV !== "development") return {};
  try {
    const skill = await getSkill(slug, locale);
    return { title: `${skill.name} · V3 Live Pilot`, description: skill.summary, robots: { index: false, follow: false } };
  } catch {
    return { robots: { index: false, follow: false } };
  }
}

export default async function Page({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  try {
    return <V3LiveSkillDetailPilot locale={locale} skill={await getSkill(slug, locale)} />;
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) notFound();
    throw error;
  }
}
