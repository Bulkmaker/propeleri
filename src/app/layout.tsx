import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: {
    default: "HC Propeleri | Hokejaski klub Novi Sad",
    template: "%s | HC Propeleri",
  },
  description:
    "Amaterski hokejaski klub Propeleri iz Novog Sada. Raspored utakmica, statistika igraca, galerija i vesti.",
  keywords: ["hokej", "hockey", "Novi Sad", "Propeleri", "amaterski hokej"],
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sr" className="dark" suppressHydrationWarning>
      <body className="font-sans antialiased min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
