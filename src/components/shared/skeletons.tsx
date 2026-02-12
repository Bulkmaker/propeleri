import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Card list skeleton — used by seasons, events, tournaments, training, gallery.
 * Mimics: Card with icon + text lines + right-side badge/button.
 */
export function SkeletonCardList({ count = 5 }: { count?: number }) {
  return (
    <div className="p-6 space-y-2">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} className="border-border/40">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
            <Skeleton className="h-7 w-20 rounded-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Game card skeleton — used by admin games list.
 * Mimics: GameMatchCard compact variant.
 */
export function SkeletonGameCardList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} className="border-border/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-16 font-mono" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Table skeleton — used by players page.
 * Mimics: Table with avatar, number, name, position, team, DOB, status, actions.
 */
export function SkeletonTable({ rows = 8, cols = 7 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full">
      <div className="flex items-center gap-4 px-4 py-3 border-b border-border/40">
        {Array.from({ length: cols }, (_, i) => (
          <Skeleton key={i} className="h-3 w-20" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border/20">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-2.5 w-2.5 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/**
 * Team grid card skeleton — used by teams page.
 * Mimics: Grid of team cards with large avatar, name, location, opponent history.
 */
export function SkeletonTeamGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} className="border-border/40 overflow-hidden">
          <CardContent className="p-6 flex flex-col items-center gap-4 text-center pt-8">
            <Skeleton className="h-40 w-40 rounded-full" />
            <div className="space-y-2 w-full">
              <Skeleton className="h-5 w-32 mx-auto" />
              <Skeleton className="h-3 w-24 mx-auto" />
            </div>
            <div className="w-full space-y-2 pt-2 border-t border-border/40 mt-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-20" />
                <div className="flex gap-1">
                  <Skeleton className="h-5 w-7 rounded-full" />
                  <Skeleton className="h-5 w-7 rounded-full" />
                  <Skeleton className="h-5 w-7 rounded-full" />
                </div>
              </div>
              {Array.from({ length: 3 }, (_, j) => (
                <Skeleton key={j} className="h-7 w-full rounded" />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
