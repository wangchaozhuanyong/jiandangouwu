import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { V2LiveCart } from "../../../components/v2-live/live-commerce";
import { getConfig, getProducts } from "../../../lib/api";
import { isLocale } from "../../../lib/copy";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cart" };

export default async function CartPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  try {
    const [config, products] = await Promise.all([
      getConfig(locale),
      getProducts({ locale, currency: "CNY", surface: "HOME" }),
    ]);
    return (
      <V2LiveCart
        config={config}
        locale={locale}
        recommendations={products.data}
      />
    );
  } catch {
    return <V2LiveCart config={null} locale={locale} recommendations={[]} />;
  }
}
