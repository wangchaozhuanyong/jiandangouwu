import { notFound } from "next/navigation";
import { StorefrontHome } from "../../components/storefront-home";
import { getStorefrontHomeData } from "../../lib/api";
import { isLocale } from "../../lib/copy";

export const dynamic = "force-dynamic";

export default async function HomePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const query = await searchParams;
  const category = typeof query.category === "string" ? query.category.slice(0, 80) : "";
  const search = typeof query.q === "string" ? query.q.slice(0, 120) : "";
  try {
    const initialData = await getStorefrontHomeData({
      locale,
      currency: "CNY",
      category: category || undefined,
      search: search || undefined,
    });
    return <StorefrontHome locale={locale} initialData={initialData} initialCategory={category} initialSearch={search} />;
  } catch {
    return <StorefrontHome locale={locale} initialData={null} initialCategory={category} initialSearch={search} />;
  }
}
