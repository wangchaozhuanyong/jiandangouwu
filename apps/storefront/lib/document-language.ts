export const DOCUMENT_LOCALE_HEADER = "x-cloudbridge-document-locale";

export type DocumentLocale = "zh" | "en";
export type DocumentLanguage = "zh-CN" | "en";

export function resolveDocumentLocale(pathname: string): DocumentLocale {
  const firstSegment = pathname.split("/")[1];
  return firstSegment === "en" ? "en" : "zh";
}

export function resolveDocumentLanguage(locale: string | null): DocumentLanguage {
  return locale === "en" ? "en" : "zh-CN";
}
