import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { isLadleProductMode } from "@/lib/product-mode";

export const metadata: Metadata = {
  title: isLadleProductMode
    ? "钢包监测系统 | 西安豪克电子有限公司"
    : "监控集成平台 | Industrial Control System",
  description: isLadleProductMode
    ? "钢包监测系统 — 西安豪克电子有限公司"
    : "Next-generation industrial control and monitoring system. Designed with precision and elegance.",
  keywords: ["industrial", "control", "monitoring", "SCADA", "automation"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="antialiased">
      <body className="min-h-screen bg-black text-white">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
