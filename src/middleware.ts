import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { routing } from "@/i18n/routing";

const intlMiddleware = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let user = null;
  let supabaseCookies: { name: string; value: string }[] = [];

  // 1. Refresh Supabase session (skip if not configured)
  if (supabaseUrl && supabaseKey && !supabaseUrl.includes("your-project")) {
    try {
      const response = NextResponse.next({ request });
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
              response.cookies.set(name, value, options)
            );
          },
        },
      });
      const { data } = await supabase.auth.getUser();
      user = data.user;
      supabaseCookies = response.cookies.getAll();
    } catch {
      // Supabase not available, continue without auth
    }
  }

  // 2. Check protected routes
  const pathname = request.nextUrl.pathname;
  const isProtectedRoute =
    pathname.includes("/profile") || pathname.includes("/admin");

  if (isProtectedRoute && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 3. Run next-intl middleware for locale handling
  const intlResponse = intlMiddleware(request);

  // Copy Supabase cookies to the intl response
  supabaseCookies.forEach((cookie) => {
    intlResponse.cookies.set(cookie.name, cookie.value);
  });

  return intlResponse;
}

export const config = {
  // Match all pathnames except for API, _next, _vercel, and static files
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
