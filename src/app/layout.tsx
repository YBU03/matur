import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { MasukOverlay } from "@/components/masuk-overlay";
import { OfflineOverlay } from "@/components/offline-overlay";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Matoer – Sistem Terintegrasi Coffeeshop",
  description: "POS, gudang, akunting, dan portal mitra CV. Hazna Berkah Indonesia",
  applicationName: "Matoer",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body className={`${jakarta.variable} font-sans antialiased`}>
        {children}
        <MasukOverlay />
        <OfflineOverlay />
      </body>
    </html>
  );
}
