import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { Analytics } from "@vercel/analytics/next";
import { routing } from "@/i18n/routing";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SkipToContentLink } from "@/components/layout/SkipToContentLink";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { createClient } from "@/lib/supabase/server";
import { exo2 } from "@/lib/fonts";
import { Profile } from "@/types/database";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: Profile | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    profile = data;
  }

  return (
    <html lang={locale} className="dark" suppressHydrationWarning>
      <body
        className={`${exo2.variable} font-sans antialiased min-h-screen flex flex-col`}
      >
        <NextIntlClientProvider messages={messages}>
          <AuthProvider initialUser={user} initialProfile={profile}>
            <SkipToContentLink />
            <Header />
            <main
              id="main-content"
              tabIndex={-1}
              className="flex-1 outline-none overflow-x-clip"
            >
              {children}
            </main>
            <Footer />
          </AuthProvider>
        </NextIntlClientProvider>
        <Analytics />
      </body>
    </html>
  );
}
