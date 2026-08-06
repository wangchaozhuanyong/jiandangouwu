import { notFound } from "next/navigation";
import { V2LiveSkillDetail } from "../../../../../storefront/components/v2-live/live-skills";
import { isLocale } from "../../../../../storefront/lib/copy";
import { readStorefrontBootstrap } from "../../../read-storefront-bootstrap";

export const dynamic = "force-dynamic";

export default async function SkillDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const bootstrap = await readStorefrontBootstrap();
  if (
    bootstrap?.kind !== "skill" ||
    bootstrap.locale !== locale ||
    bootstrap.slug !== slug ||
    !bootstrap.data.skill
  ) {
    notFound();
  }
  return <V2LiveSkillDetail locale={locale} skill={bootstrap.data.skill} />;
}
