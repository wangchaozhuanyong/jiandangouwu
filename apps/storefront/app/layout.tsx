import type { Metadata } from "next";
import { headers } from "next/headers";
import { ExperienceProvider } from "../components/experience-provider";
import {
  DOCUMENT_LOCALE_HEADER,
  resolveDocumentLanguage,
} from "../lib/document-language";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "CloudBridge",
    template: "%s · CloudBridge",
  },
  description: "AI software services with clear local pricing and human support.",
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
