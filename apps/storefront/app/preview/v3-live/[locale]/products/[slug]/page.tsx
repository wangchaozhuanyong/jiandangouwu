import { notFound } from "next/navigation";
import { V3LiveProductPilot } from "../../../../../../components/v3-live/v3-live-pilot";
import { ApiRequestError, getProduct } from "../../../../../../lib/api";
import { isLocale } from "../../../../../../lib/copy";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  try {
    const product = await getProduct(slug, locale, "CNY");
    return <V3LiveProductPilot locale={locale} product={product} />;
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) notFound();
    return notFound();
  }
}
