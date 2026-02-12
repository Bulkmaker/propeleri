import Image from "next/image";
import { MapPin } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TeamAvatar } from "@/components/matches/TeamAvatar";
import { cn } from "@/lib/utils";

type Variant = "poster" | "compact";

type Props = {
  href?: string;
  teamName: string;
  opponentName: string;
  opponentLogoUrl?: string | null;
  opponentCountry?: string | null;
  teamScore?: number;
  opponentScore?: number;
  dateLabel: string;
  timeLabel: string;
  location?: string | null;
  resultLabel: string;
  resultClassName: string;
  matchTimeLabel?: string;
  variant?: Variant;
  badges?: React.ReactNode;
  actions?: React.ReactNode;
};

export function GameMatchCard({
  href,
  teamName,
  opponentName,
  opponentLogoUrl,
  opponentCountry,
  teamScore,
  opponentScore,
  dateLabel,
  timeLabel,
  location,
  resultLabel,
  resultClassName,
  matchTimeLabel,
  variant = "poster",
  badges,
  actions,
}: Props) {
  const isPending = teamScore == null || opponentScore == null;

  if (variant === "compact") {
    const compactContent = (
      <div className="block">
        <Card className="border-border/40 bg-card/95 card-hover cursor-pointer py-0">
          <CardContent className="px-2.5 py-2.5 md:px-3.5 md:py-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                  <Image
                    src="/logo.svg"
                    alt={teamName}
                    width={24}
                    height={24}
                    className="h-6 w-6 object-contain shrink-0"
                  />
                  <span className="font-semibold text-sm truncate">{teamName}</span>
                  {isPending ? (
                    <span className="text-muted-foreground text-xs mx-1">vs</span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded bg-secondary text-xs font-bold tabular-nums shrink-0">
                      {teamScore}:{opponentScore}
                    </span>
                  )}
                  <TeamAvatar
                    name={opponentName}
                    logoUrl={opponentLogoUrl}
                    country={opponentCountry}
                    size="xs"
                    className="h-6 w-6"
                  />
                  <span className="font-semibold text-sm truncate">{opponentName}</span>
                </div>

                <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{dateLabel}</span>
                  <span className="text-sm font-semibold leading-none text-foreground">{timeLabel}</span>
                  {location && (
                    <span className="hidden sm:inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {location}
                    </span>
                  )}
                </div>
              </div>

              {(badges || !isPending || actions) && (
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto mt-2 sm:mt-0">
                  {badges}
                  {!isPending && (
                    <Badge className={cn("text-[10px] h-5 px-1.5", resultClassName)}>
                      {resultLabel}
                    </Badge>
                  )}
                  {actions}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );

    if (!href) return compactContent;
    return <Link href={href}>{compactContent}</Link>;
  }

  const posterContent = (
    <div className="block max-w-4xl mx-auto px-1 md:px-2   my-8">
      <Card className="border-primary/20 card-hover bg-[radial-gradient(circle_at_50%_38%,rgba(255,255,255,0.08),transparent_52%),linear-gradient(135deg,rgba(12,28,59,0.95),rgba(14,26,53,0.96))] cursor-pointer overflow-hidden py-0">
        <CardContent className="px-4 py-4 md:px-12 md:py-9 relative">
          <div className="pointer-events-none absolute -bottom-10 -left-10 h-28 w-28 rounded-full bg-red-500/20 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-10 -right-10 h-28 w-28 rounded-full bg-blue-500/25 blur-2xl" />

          <div className="relative space-y-4 md:space-y-2">
            <div className={cn("flex items-start justify-between gap-3", isPending && "hidden sm:flex")}>
              <div className="min-h-5" />
              <div className="flex items-center gap-2">
                {location && !isPending && (
                  <span className="text-xs text-muted-foreground hidden md:flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {location}
                  </span>
                )}
                {badges}
                <Badge className={cn("text-xs", resultClassName)}>
                  {resultLabel}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-[1fr_auto_1fr] items-center gap-y-6 gap-x-3 md:gap-6">
              {/* Home Team */}
              <div className="flex flex-col items-center text-center gap-2 order-1 md:order-none">
                <Image
                  src="/logo.svg"
                  alt={teamName}
                  width={140}
                  height={140}
                  className="h-24 w-24 sm:h-28 sm:w-28 md:h-36 md:w-36 object-contain"
                />
                <span className="font-bold text-sm sm:text-base md:text-2xl tracking-wide line-clamp-2 md:line-clamp-none">
                  {teamName.toUpperCase()}
                </span>
              </div>

              {/* Away Team (Mobile: Right Column) */}
              <div className="flex flex-col items-center text-center gap-2 order-2 md:order-last">
                <TeamAvatar
                  name={opponentName}
                  logoUrl={opponentLogoUrl}
                  country={opponentCountry}
                  size="lg"
                  className="h-24 w-24 sm:h-28 sm:w-28 md:h-36 md:w-36 text-3xl sm:text-4xl md:text-5xl"
                />
                <div className={cn("font-bold text-sm sm:text-base md:text-2xl tracking-wide line-clamp-2 md:line-clamp-none")}>
                  {opponentName.toUpperCase()}
                </div>
              </div>

              {/* Main Info Area (Mobile: Below Teams, spans 2 cols) */}
              <div className="col-span-2 md:col-span-1 text-center order-3 md:order-none">
                {isPending ? (
                  <div className="flex flex-col items-center justify-center">
                    {matchTimeLabel && (
                      <p className="text-[10px] md:text-sm uppercase tracking-[0.18em] text-muted-foreground mb-1">
                        {matchTimeLabel}
                      </p>
                    )}
                    <div className="flex flex-col md:block items-center">
                      <p className="text-4xl md:text-7xl font-black leading-none bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/70">
                        {timeLabel}
                      </p>
                      <div className="mt-2 md:mt-1 px-3 py-1 md:px-0 md:py-0 rounded-full bg-primary/10 md:bg-transparent inline-block">
                        <p className="text-xs md:text-2xl font-bold uppercase tracking-widest text-primary md:text-foreground">
                          {dateLabel}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center">
                    <div className="relative group p-4 md:p-0">
                      <div className="absolute inset-0 bg-primary/5 blur-xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity" />
                      <div className="relative flex items-center justify-center gap-3 md:gap-4 px-6 py-2 md:px-0 md:py-0 rounded-xl bg-background/5 md:bg-transparent border border-white/5 md:border-none backdrop-blur-sm md:backdrop-blur-none shadow-2xl md:shadow-none">
                        <span className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tighter leading-none text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                          {teamScore}
                        </span>
                        <div className="flex flex-col items-center gap-0.5 opacity-40">
                          <div className="h-1 w-1 rounded-full bg-white" />
                          <div className="h-1 w-1 rounded-full bg-white" />
                        </div>
                        <span className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tighter leading-none text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                          {opponentScore}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 md:mt-1.5 flex flex-col md:gap-0.5">
                      <p className="text-[10px] md:text-xl font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        {dateLabel}
                      </p>
                      <p className="text-sm md:text-3xl font-bold tracking-tight text-foreground/90">{timeLabel}</p>
                      {location && (
                        <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5 mt-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {location}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  if (!href) return posterContent;
  return <Link href={href}>{posterContent}</Link>;
}
