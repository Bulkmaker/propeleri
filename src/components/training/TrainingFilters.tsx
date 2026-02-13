"use client";

import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Video } from "lucide-react";

interface SeasonOption {
  id: string;
  name: string;
}

interface TrainingFiltersProps {
  seasons: SeasonOption[];
  currentSeasonId: string;
  videoFilter: boolean;
  videoLabel: string;
}

export function TrainingFilters({
  seasons,
  currentSeasonId,
  videoFilter,
  videoLabel,
}: TrainingFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function buildUrl(overrides: Record<string, string | null>) {
    const params = new URLSearchParams();
    const season = searchParams.get("season");
    const video = searchParams.get("video");
    if (season) params.set("season", season);
    if (video) params.set("video", video);
    for (const [key, value] of Object.entries(overrides)) {
      if (value === null) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={videoFilter ? "default" : "outline"}
        size="sm"
        onClick={() => {
          router.push(buildUrl({ video: videoFilter ? null : "1" }));
        }}
        className="gap-1.5"
      >
        <Video className="h-4 w-4" />
        <span className="hidden sm:inline">{videoLabel}</span>
      </Button>
      {seasons.length > 1 && (
        <Select
          value={currentSeasonId}
          onValueChange={(value) => {
            router.push(buildUrl({ season: value }));
          }}
        >
          <SelectTrigger className="w-[200px] bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {seasons.map((season) => (
              <SelectItem key={season.id} value={season.id}>
                {season.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
