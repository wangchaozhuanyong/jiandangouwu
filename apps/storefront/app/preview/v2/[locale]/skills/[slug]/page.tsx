import { notFound } from "next/navigation";
import { V2PreviewSkillDetail } from "../../../../../../components/v2-preview/preview-pages";
import { isLocale } from "../../../../../../lib/copy";

export default async function PreviewV2SkillDetailPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  return <V2PreviewSkillDetail locale={locale} slug={slug.slice(0, 100)} />;
}
