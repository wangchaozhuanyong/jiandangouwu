import { notFound } from "next/navigation";
import { V3LiveSkillsPilot } from "../../../../../components/v3-live/v3-live-secondary";
import { getSkillCategories, getSkills } from "../../../../../lib/api";
import { isLocale } from "../../../../../lib/copy";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  try {
    const [categories, skills] = await Promise.all([
      getSkillCategories(locale),
      getSkills({ locale }),
    ]);
    return <V3LiveSkillsPilot categories={categories} locale={locale} skills={skills.data} />;
  } catch {
    return <V3LiveSkillsPilot categories={[]} locale={locale} skills={[]} />;
  }
}
