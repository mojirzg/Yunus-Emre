import type { Metadata, Viewport } from "next";
import { Inter, Vazirmatn } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

const vazirmatn = Vazirmatn({
  subsets: ["arabic"],
  variable: "--font-vazirmatn",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Yedi İklim Türkçe Vocab",
    template: "%s | Türkçe Vocab",
  },
  description:
    "Mobile-first Turkish vocabulary trainer for Yedi İklim Türkçe with English and Persian translations.",
  applicationName: "Türkçe Vocab",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Türkçe Vocab",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f766e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${vazirmatn.variable}`}>
      <body className="min-h-dvh bg-stone-50 text-stone-900 antialiased">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
