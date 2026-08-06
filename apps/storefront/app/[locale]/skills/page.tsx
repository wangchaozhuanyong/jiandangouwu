import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { V2LiveSkills } from "../../../components/v2-live/live-skills";
import { getSkillCategories, getSkills } from "../../../lib/api";
import { isLocale } from "../../../lib/copy";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Skill recommendations" };

export default async function SkillsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  try {
    const [categories, skills] = await Promise.all([
      getSkillCategories(locale),
      getSkills({ locale }),
    ]);
    return (
      <V2LiveSkills
        categories={categories}
        initialSkills={skills.data}
        locale={locale}
      />
    );
  } catch {
    return <V2LiveSkills categories={[]} initialSkills={[]} locale={locale} />;
  }
}
