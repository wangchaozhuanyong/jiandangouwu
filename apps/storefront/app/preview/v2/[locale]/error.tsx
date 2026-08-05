"use client";

import { useParams } from "next/navigation";
import { V2PreviewError } from "../../../../components/v2-preview/preview-pages";

export default function PreviewV2ErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const params = useParams<{ locale?: string }>();
  return <V2PreviewError locale={params.locale === "en" ? "en" : "zh"} reset={reset} />;
}
