import { notFound } from "next/navigation";
import { V2LiveCart } from "../../../../storefront/components/v2-live/live-commerce";
import { isLocale } from "../../../../storefront/lib/copy";
import { readStorefrontBootstrap } from "../../read-storefront-bootstrap";

export const dynamic = "force-dynamic";

export default async function CartPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const bootstrap = await readStorefrontBootstrap();
  const data =
    bootstrap?.kind === "cart" && bootstrap.locale === locale
      ? bootstrap.data
      : null;
  return (
    <V2LiveCart
      config={data?.config ?? null}
      locale={locale}
      recommendations={data?.products ?? []}
    />
  );
}
