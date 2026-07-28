import type { Metadata } from "next";
import { ExperienceProvider } from "../components/experience-provider";
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body><ExperienceProvider>{children}</ExperienceProvider></body>
    </html>
  );
}
