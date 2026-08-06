import { notFound } from "next/navigation";
import { V2LiveSkills } from "../../../../storefront/components/v2-live/live-skills";
import { isLocale } from "../../../../storefront/lib/copy";
import { readStorefrontBootstrap } from "../../read-storefront-bootstrap";

export const dynamic = "force-dynamic";

export default async function SkillsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const bootstrap = await readStorefrontBootstrap();
  const data =
    bootstrap?.kind === "skills" && bootstrap.locale === locale
      ? bootstrap.data
      : null;
  return (
    <V2LiveSkills
      categories={data?.categories ?? []}
      initialSkills={data?.skills ?? []}
      locale={locale}
    />
  );
}
