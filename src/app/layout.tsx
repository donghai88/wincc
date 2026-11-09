import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { productBrandSubtitle, productBrandTitle } from "@/lib/product-mode";

const documentTitle = productBrandSubtitle
  ? `${productBrandTitle} | ${productBrandSubtitle}`
  : productBrandTitle;

export const metadata: Metadata = {
  title: documentTitle,
  description: documentTitle,
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
