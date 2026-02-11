import { cn } from "@/lib/utils";

type Props = {
  teamAScore: number;
  teamBScore: number;
  teamALabel: string;
  teamBLabel: string;
  variant?: "compact" | "panel";
  className?: string;
};

export function TrainingScoreView({
  teamAScore,
  teamBScore,
  teamALabel,
  teamBLabel,
  variant = "compact",
  className,
}: Props) {
  if (variant === "panel") {
    return (
      <div
        className={cn(
          "rounded-xl border border-primary/20 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.07),transparent_55%),linear-gradient(135deg,rgba(12,28,59,0.95),rgba(14,26,53,0.96))] p-4",
          className
        )}
      >
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="text-center">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {teamALabel}
            </p>
            <p className="text-4xl font-black leading-none tabular-nums">{teamAScore}</p>
          </div>
          <p className="text-2xl text-muted-foreground">:</p>
          <div className="text-center">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {teamBLabel}
            </p>
            <p className="text-4xl font-black leading-none tabular-nums">{teamBScore}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-border/60 bg-secondary/30 px-3 py-2 text-center min-w-[94px]",
        className
      )}
    >
      <div className="flex items-center justify-center gap-2">
        <span className="h-2 w-2 rounded-full bg-white border border-border" />
        <p className="text-lg font-black leading-none tabular-nums">{teamAScore}</p>
        <p className="text-muted-foreground">:</p>
        <p className="text-lg font-black leading-none tabular-nums">{teamBScore}</p>
        <span className="h-2 w-2 rounded-full bg-gray-600" />
      </div>
      <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {teamALabel} / {teamBLabel}
      </p>
    </div>
  );
}
