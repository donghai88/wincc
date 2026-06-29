import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "监控集成平台 | Industrial Control System",
  description: "Next-generation industrial control and monitoring system. Designed with precision and elegance.",
  keywords: ["industrial", "control", "monitoring", "SCADA", "automation"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.className} antialiased`}>
      <body className="min-h-screen bg-black text-white">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
