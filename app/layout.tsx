import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "知识大地 Terra Cognita · 人类知识与技术底图",
  description: "一张会生长的人类知识与技术底图——看清知识如何长成技术，技术如何反哺知识。",
  icons: {
    icon:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='13' fill='%230d1420' stroke='%23d9b36c' stroke-width='2'/%3E%3Ccircle cx='11' cy='13' r='3' fill='%2389ddff'/%3E%3Ccircle cx='20' cy='11' r='2.4' fill='%235fd68a'/%3E%3Ccircle cx='19' cy='21' r='3.4' fill='%23ffd166'/%3E%3Ccircle cx='11.5' cy='20' r='2' fill='%23ff5370'/%3E%3C/svg%3E",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d1420",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body data-view="map">{children}</body>
    </html>
  );
}
