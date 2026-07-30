import { notFound } from "next/navigation";
import { StorefrontHome } from "../../../storefront/components/storefront-home";
import { isLocale } from "../../../storefront/lib/copy";
import { readStorefrontBootstrap } from "../read-storefront-bootstrap";

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
  const bootstrap = await readStorefrontBootstrap();
  const initialData = (
    bootstrap?.kind === "home"
    && bootstrap.locale === locale
    && bootstrap.category === category
    && bootstrap.search === search
  ) ? bootstrap.data : null;
  return (
    <StorefrontHome
      locale={locale}
      initialData={initialData}
      initialCategory={category}
      initialSearch={search}
    />
  );
}
