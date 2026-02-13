import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://propeleri.rs"),
  title: {
    default: "HC Propeleri | Hokejaski klub Novi Sad",
    template: "%s | HC Propeleri",
  },
  description:
    "Amaterski hokejaski klub Propeleri iz Novog Sada. Raspored utakmica, statistika igraca, galerija i vesti.",
  keywords: [
    "hokej",
    "hockey",
    "Novi Sad",
    "Propeleri",
    "amaterski hokej",
    "ice hockey",
    "Serbia",
  ],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    siteName: "HC Propeleri",
    locale: "sr_RS",
    alternateLocale: ["ru_RU", "en_US"],
    images: [{ url: "/og-default.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
