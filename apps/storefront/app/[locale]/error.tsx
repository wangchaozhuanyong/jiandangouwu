"use client";

import { WarningCircle } from "@phosphor-icons/react";
import { useParams } from "next/navigation";
import { copy, isLocale } from "../../lib/copy";

export default function LocaleError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams<{ locale: string }>();
  const locale = isLocale(params.locale) ? params.locale : "zh";
  const t = copy[locale];
  return (
    <main className="route-error" role="alert">
      <WarningCircle size={34} aria-hidden="true" />
      <h1>{t.loadError}</h1>
      <button onClick={reset}>{t.retry}</button>
    </main>
  );
}
