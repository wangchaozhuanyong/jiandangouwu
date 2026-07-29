import type { Metadata } from "next";
import { ExperienceProvider } from "../../storefront/components/experience-provider";
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body><ExperienceProvider>{children}</ExperienceProvider></body>
    </html>
  );
}
