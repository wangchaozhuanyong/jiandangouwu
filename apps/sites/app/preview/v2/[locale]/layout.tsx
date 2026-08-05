import { notFound } from "next/navigation";
import { V2PreviewShell } from "../../../../../storefront/components/v2-preview/preview-shell";
import { isLocale } from "../../../../../storefront/lib/copy";

export const dynamic = "force-dynamic";

export default async function SitesPreviewV2Layout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <V2PreviewShell initialConfig={null} locale={locale}>{children}</V2PreviewShell>;
}
