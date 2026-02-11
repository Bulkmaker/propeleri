import type { Metadata } from "next";
import { Exo_2 } from "next/font/google";
import "@/app/globals.css";

const exo2 = Exo_2({
  subsets: ["latin", "cyrillic"],
  variable: "--font-exo-2",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "HC Propeleri | Hokejaski klub Novi Sad",
    template: "%s | HC Propeleri",
  },
  description:
    "Amaterski hokejaski klub Propeleri iz Novog Sada. Raspored utakmica, statistika igraca, galerija i vesti.",
  keywords: ["hokej", "hockey", "Novi Sad", "Propeleri", "amaterski hokej"],
  icons: {
    icon: "/logo.svg",
    shortcut: "/logo.svg",
    apple: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sr" className="dark" suppressHydrationWarning>
      <body className={`${exo2.variable} font-sans antialiased min-h-screen flex flex-col`}>
        {children}
      </body>
    </html>
  );
}
