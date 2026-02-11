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
        <Card className="border-border/40 bg-card/95 card-hover cursor-pointer">
          <CardContent className="px-2.5 py-2.5 md:px-3.5 md:py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                  <Image
                    src="/logo.svg"
                    alt={teamName}
                    width={28}
                    height={28}
                    className="h-7 w-7 object-contain shrink-0"
                  />
                  <span className="font-semibold text-sm md:text-base truncate">{teamName}</span>
                  {isPending ? (
                    <span className="text-muted-foreground text-sm">vs</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-secondary text-sm font-bold tabular-nums">
                      {teamScore}:{opponentScore}
                    </span>
                  )}
                  <TeamAvatar
                    name={opponentName}
                    logoUrl={opponentLogoUrl}
                    country={opponentCountry}
                    size="sm"
                  />
                  <span className="font-semibold text-sm md:text-base truncate">{opponentName}</span>
                </div>

                <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{dateLabel}</span>
                  <span className="text-base font-semibold leading-none text-foreground">{timeLabel}</span>
                  {location && (
                    <span className="hidden md:inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {location}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {badges}
                <Badge className={`text-xs ${resultClassName}`}>{resultLabel}</Badge>
                {actions}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );

    if (!href) return compactContent;
    return <Link href={href}>{compactContent}</Link>;
  }

  const posterContent = (
    <div className="block max-w-4xl mx-auto px-1 md:px-2 py-0.5 md:py-1">
      <Card className="border-primary/20 card-hover bg-[radial-gradient(circle_at_50%_38%,rgba(255,255,255,0.08),transparent_52%),linear-gradient(135deg,rgba(12,28,59,0.95),rgba(14,26,53,0.96))] cursor-pointer overflow-hidden">
        <CardContent className="px-4 py-4 md:px-6 md:py-4.5 relative">
          <div className="pointer-events-none absolute -bottom-10 -left-10 h-28 w-28 rounded-full bg-red-500/20 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-10 -right-10 h-28 w-28 rounded-full bg-blue-500/25 blur-2xl" />

          <div className="relative space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-h-5" />
              <div className="flex items-center gap-2">
                {location && (
                  <span className="text-xs text-muted-foreground hidden md:flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {location}
                  </span>
                )}
                {badges}
                <Badge className={`text-xs ${resultClassName}`}>{resultLabel}</Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-3 md:gap-6">
              <div className="flex flex-col items-center md:items-start text-center md:text-left gap-2">
                <Image
                  src="/logo.svg"
                  alt={teamName}
                  width={140}
                  height={140}
                  className="h-20 w-20 md:h-28 md:w-28 object-contain"
                />
                <span className="font-bold text-base md:text-2xl tracking-wide">{teamName.toUpperCase()}</span>
              </div>

              <div className="text-center order-last md:order-none">
                {isPending ? (
                  <>
                    {matchTimeLabel && (
                      <p className="text-[11px] md:text-sm uppercase tracking-[0.18em] text-muted-foreground mb-1">
                        {matchTimeLabel}
                      </p>
                    )}
                    <p className="text-5xl md:text-7xl font-black leading-none">{timeLabel}</p>
                    <p className="mt-1 text-base md:text-2xl font-bold uppercase tracking-wide">
                      {dateLabel}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-5xl md:text-7xl font-black leading-none">
                        {teamScore}
                      </span>
                      <span className="text-3xl md:text-4xl text-muted-foreground">:</span>
                      <span className="text-5xl md:text-7xl font-black leading-none">
                        {opponentScore}
                      </span>
                    </div>
                    <p className="mt-1 text-base md:text-xl font-semibold uppercase tracking-wide">
                      {dateLabel}
                    </p>
                    <p className="text-xl md:text-3xl font-bold leading-none mt-0.5">{timeLabel}</p>
                  </>
                )}
              </div>

              <div className="flex flex-col items-center md:items-end text-center md:text-right gap-2">
                {opponentLogoUrl ? (
                  <img
                    src={opponentLogoUrl}
                    alt={opponentName}
                    className="h-20 w-20 md:h-28 md:w-28 object-contain drop-shadow-[0_0_16px_rgba(255,255,255,0.12)]"
                  />
                ) : (
                  <TeamAvatar
                    name={opponentName}
                    country={opponentCountry}
                    size="lg"
                    className="h-20 w-20 md:h-28 md:w-28 text-4xl md:text-5xl"
                  />
                )}
                <div className={cn("font-bold text-base md:text-2xl tracking-wide max-w-[220px] truncate")}>
                  {opponentName}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center md:justify-end gap-2">
              {location && (
                <span className="text-xs text-muted-foreground md:hidden flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {location}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  if (!href) return posterContent;
  return <Link href={href}>{posterContent}</Link>;
}
