import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { V2LiveSkillDetail } from "../../../../components/v2-live/live-skills";
import { ApiRequestError, getSkill } from "../../../../lib/api";
import { isLocale } from "../../../../lib/copy";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  try {
    const skill = await getSkill(slug, locale);
    return { title: skill.name, description: skill.summary };
  } catch {
    return {};
  }
}

export default async function SkillDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  try {
    return (
      <V2LiveSkillDetail locale={locale} skill={await getSkill(slug, locale)} />
    );
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) notFound();
    throw error;
  }
}
