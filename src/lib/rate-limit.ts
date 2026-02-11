/**
 * Simple in-memory rate limiter for API routes.
 *
 * Uses a sliding-window approach: tracks request timestamps per key,
 * only keeping entries within the window. No external deps needed.
 *
 * Usage:
 *   import { rateLimit } from "@/lib/rate-limit";
 *   const limiter = rateLimit({ windowMs: 60_000, max: 10 });
 *
 *   export async function POST(request: Request) {
 *     const ip = request.headers.get("x-forwarded-for") ?? "unknown";
 *     const { success } = limiter.check(ip);
 *     if (!success) {
 *       return NextResponse.json({ error: "Too many requests" }, { status: 429 });
 *     }
 *     // ... handle request
 *   }
 */

interface RateLimitOptions {
    /** Time window in milliseconds (default: 60 000 = 1 min) */
    windowMs?: number;
    /** Max requests per window (default: 10) */
    max?: number;
}

interface RateLimitResult {
    success: boolean;
    remaining: number;
    resetMs: number;
}

export function rateLimit({ windowMs = 60_000, max = 10 }: RateLimitOptions = {}) {
    const hits = new Map<string, number[]>();

    // Periodic cleanup to prevent memory leaks (every 5 minutes)
    const CLEANUP_INTERVAL = 5 * 60_000;
    let lastCleanup = Date.now();

    function cleanup(now: number) {
        if (now - lastCleanup < CLEANUP_INTERVAL) return;
        lastCleanup = now;

        for (const [key, timestamps] of hits) {
            const valid = timestamps.filter((t) => now - t < windowMs);
            if (valid.length === 0) {
                hits.delete(key);
            } else {
                hits.set(key, valid);
            }
        }
    }

    function check(key: string): RateLimitResult {
        const now = Date.now();
        cleanup(now);

        const timestamps = (hits.get(key) ?? []).filter((t) => now - t < windowMs);

        if (timestamps.length >= max) {
            const oldestInWindow = timestamps[0];
            return {
                success: false,
                remaining: 0,
                resetMs: oldestInWindow + windowMs - now,
            };
        }

        timestamps.push(now);
        hits.set(key, timestamps);

        return {
            success: true,
            remaining: max - timestamps.length,
            resetMs: windowMs,
        };
    }

    return { check };
}
