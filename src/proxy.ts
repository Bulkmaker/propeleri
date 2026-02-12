import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { routing } from "@/i18n/routing";
import type { CookieOptions } from "@supabase/ssr";

const intlMiddleware = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let user = null;
  const supabaseCookies: { name: string; value: string; options: CookieOptions }[] = [];

  // 1. Refresh Supabase session (skip if not configured)
  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createServerClient(supabaseUrl, supabaseKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseCookies.push({ name, value, options })
            );
          },
        },
        cookieOptions: {
          name: "sb-auth-token",
          maxAge: 60 * 60 * 24 * 7, // 7 days
          domain: undefined,
          path: "/",
          sameSite: "lax",
        },
      });
      const { data } = await supabase.auth.getUser();
      user = data.user;
    } catch {
      // Supabase not available, continue without auth
    }
  }

  // 2. Check protected routes
  const pathname = request.nextUrl.pathname;
  const isProtectedRoute =
    pathname.includes("/profile") || pathname.includes("/admin");

  if (isProtectedRoute && !user) {
    const segments = pathname.split("/");
    const localeSegment = segments[1];
    const availableLocales = routing.locales;
    const hasLocale = (availableLocales as readonly string[]).includes(localeSegment);
    const locale = hasLocale ? localeSegment : routing.defaultLocale;

    const loginUrl = new URL(hasLocale ? `/${locale}/login` : "/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    const redirectResponse = NextResponse.redirect(loginUrl);
    supabaseCookies.forEach(({ name, value, options }) => {
      redirectResponse.cookies.set(name, value, options);
    });
    return redirectResponse;
  }

  // 3. Run next-intl middleware for locale handling
  const intlResponse = intlMiddleware(request);

  // Copy Supabase cookies with full options to the intl response
  supabaseCookies.forEach(({ name, value, options }) => {
    intlResponse.cookies.set(name, value, options);
  });

  return intlResponse;
}

export const config = {
  // Match all pathnames except for API, _next, _vercel, and static files
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
