import { notFound } from "next/navigation";
import { V2LiveShell } from "../../../storefront/components/v2-live/live-shell";
import { isLocale } from "../../../storefront/lib/copy";
import { readStorefrontBootstrap } from "../read-storefront-bootstrap";

export const dynamic = "force-dynamic";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const bootstrap = await readStorefrontBootstrap();
  const initialConfig =
    bootstrap?.locale === locale ? bootstrap.data.config : null;
  return (
    <V2LiveShell locale={locale} initialConfig={initialConfig}>
      {children}
    </V2LiveShell>
  );
}
