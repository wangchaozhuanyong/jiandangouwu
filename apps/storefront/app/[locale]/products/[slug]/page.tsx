import { notFound } from "next/navigation";
import { ProductDetailView } from "../../../../components/product-detail";
import { ApiRequestError, getConfig, getProduct } from "../../../../lib/api";
import { isLocale } from "../../../../lib/copy";

export const dynamic = "force-dynamic";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  try {
    const [initialProduct, initialConfig] = await Promise.all([
      getProduct(slug, locale, "CNY"),
      getConfig(locale),
    ]);
    return (
      <ProductDetailView
        locale={locale}
        slug={slug}
        initialProduct={initialProduct}
        initialConfig={initialConfig}
      />
    );
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) notFound();
    return (
      <ProductDetailView
        locale={locale}
        slug={slug}
        initialProduct={null}
        initialConfig={null}
      />
    );
  }
}
