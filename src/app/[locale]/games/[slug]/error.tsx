"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";

export default function GameError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const tc = useTranslations("common");

  useEffect(() => {
    console.error("[Game Error]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <AlertTriangle className="h-10 w-10 text-destructive" />
      <h2 className="text-lg font-semibold">{tc("error_title") || "Something went wrong"}</h2>
      <p className="text-sm text-muted-foreground max-w-md text-center">
        {error.message}
      </p>
      <Button onClick={reset} variant="outline">
        {tc("try_again") || "Try again"}
      </Button>
    </div>
  );
}
