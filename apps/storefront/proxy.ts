import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  DOCUMENT_LOCALE_HEADER,
  resolveDocumentLocale,
} from "./lib/document-language";

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    DOCUMENT_LOCALE_HEADER,
    resolveDocumentLocale(request.nextUrl.pathname),
  );

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|assets|favicon.ico|robots.txt|sitemap.xml|v1|media).*)",
  ],
};
