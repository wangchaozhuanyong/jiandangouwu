import { notFound } from "next/navigation";
import { ProductDetailView } from "../../../../../storefront/components/product-detail";
import { isLocale } from "../../../../../storefront/lib/copy";

export const dynamic = "force-dynamic";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <ProductDetailView
      locale={locale}
      slug={slug}
      initialProduct={null}
      initialConfig={null}
    />
  );
}
