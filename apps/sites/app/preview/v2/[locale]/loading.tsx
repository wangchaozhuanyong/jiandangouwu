"use client";

import { useParams } from "next/navigation";
import { V2PreviewLoading } from "../../../../../storefront/components/v2-preview/preview-pages";

export default function SitesPreviewV2Loading() {
  const params = useParams<{ locale?: string }>();
  return <V2PreviewLoading locale={params.locale === "en" ? "en" : "zh"} />;
}
