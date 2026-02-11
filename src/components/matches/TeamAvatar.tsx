"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { countryFlagFromValue } from "@/lib/utils/country";

const SIZE_CLASSES = {
  xs: "h-5 w-5 text-[10px]",
  sm: "h-6 w-6 text-xs",
  md: "h-8 w-8 text-sm",
  lg: "h-10 w-10 text-base",
} as const;

export function TeamAvatar({
  name,
  logoUrl,
  country,
  size = "sm",
  className,
}: {
  name: string;
  logoUrl?: string | null;
  country?: string | null;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}) {
  const flag = countryFlagFromValue(country);
  const initial = name.trim().slice(0, 1).toUpperCase() || "?";
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
  const shouldRenderLogo = Boolean(logoUrl) && failedLogoUrl !== logoUrl;

  return (
    <div
      className={cn(
        "shrink-0 rounded-full border border-border/40 overflow-hidden bg-muted flex items-center justify-center font-semibold",
        SIZE_CLASSES[size],
        className
      )}
      title={name}
      aria-label={name}
    >
      {shouldRenderLogo ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={logoUrl ?? undefined}
          alt={name}
          className="h-full w-full object-contain"
          onError={() => setFailedLogoUrl(logoUrl ?? null)}
        />
      ) : (
        <span>{flag ?? initial}</span>
      )}
    </div>
  );
}
