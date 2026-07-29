import type { Metadata } from "next";
import { headers } from "next/headers";
import { ExperienceProvider } from "../../storefront/components/experience-provider";
import {
  DOCUMENT_LOCALE_HEADER,
  resolveDocumentLanguage,
} from "../../storefront/lib/document-language";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "CloudBridge",
    template: "%s · CloudBridge",
  },
  description: "全球 AI 工具、本地币种价格与人工服务，在一座桥上相遇。",
  icons: {
    icon: "/assets/cloudbridge-logo.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const documentLanguage = resolveDocumentLanguage(
    requestHeaders.get(DOCUMENT_LOCALE_HEADER),
  );

  return (
    <html lang={documentLanguage}>
      <body><ExperienceProvider>{children}</ExperienceProvider></body>
    </html>
  );
}
