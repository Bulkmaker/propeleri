import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          // Check if we're in browser environment
          if (typeof document === 'undefined') {
            return [];
          }
          // Parse document.cookie to get all cookies
          return document.cookie
            .split('; ')
            .filter(cookie => cookie)
            .map(cookie => {
              const [name, ...rest] = cookie.split('=');
              return { name, value: rest.join('=') };
            });
        },
        setAll(cookiesToSet) {
          // Check if we're in browser environment
          if (typeof document === 'undefined') {
            return;
          }
          // Set cookies via document.cookie
          cookiesToSet.forEach(({ name, value, options }) => {
            let cookie = `${name}=${value}`;
            if (options?.path) cookie += `; path=${options.path}`;
            if (options?.maxAge) cookie += `; max-age=${options.maxAge}`;
            if (options?.sameSite) cookie += `; samesite=${options.sameSite}`;
            if (options?.secure) cookie += '; secure';
            document.cookie = cookie;
          });
        },
      },
    }
  );
}
