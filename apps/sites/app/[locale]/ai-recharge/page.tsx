import { notFound } from "next/navigation";
import { V2LiveCatalogPage } from "../../../../storefront/components/v2-live/live-catalog";
import { isLocale } from "../../../../storefront/lib/copy";
import { readStorefrontBootstrap } from "../../read-storefront-bootstrap";

export const dynamic = "force-dynamic";

export default async function AiRechargePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const bootstrap = await readStorefrontBootstrap();
  const data =
    bootstrap?.kind === "catalog" &&
    bootstrap.locale === locale &&
    bootstrap.surface === "AI_RECHARGE"
      ? bootstrap.data
      : null;
  return (
    <V2LiveCatalogPage
      banners={data?.banners ?? []}
      categories={data?.categories ?? []}
      config={data?.config ?? null}
      initialProducts={data?.products ?? []}
      locale={locale}
      surface="AI_RECHARGE"
    />
  );
}
