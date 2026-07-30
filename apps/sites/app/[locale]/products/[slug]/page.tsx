import { notFound } from "next/navigation";
import { ProductDetailView } from "../../../../../storefront/components/product-detail";
import { isLocale } from "../../../../../storefront/lib/copy";
import { readStorefrontBootstrap } from "../../../read-storefront-bootstrap";

export const dynamic = "force-dynamic";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const bootstrap = await readStorefrontBootstrap();
  const initialData = (
    bootstrap?.kind === "product"
    && bootstrap.locale === locale
    && bootstrap.slug === slug
  ) ? bootstrap.data : null;
  return (
    <ProductDetailView
      locale={locale}
      slug={slug}
      initialProduct={initialData?.product ?? null}
      initialConfig={initialData?.config ?? null}
    />
  );
}
