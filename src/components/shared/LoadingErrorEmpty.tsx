"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

interface LoadingErrorEmptyProps {
  loading: boolean;
  error?: string | null;
  isEmpty?: boolean;
  emptyMessage?: string;
  onRetry?: () => void;
  skeleton?: React.ReactNode;
  children: React.ReactNode;
}

export function LoadingErrorEmpty({
  loading,
  error,
  isEmpty,
  emptyMessage,
  onRetry,
  skeleton,
  children,
}: LoadingErrorEmptyProps) {
  const tc = useTranslations("common");

  if (loading) {
    if (skeleton) {
      return <>{skeleton}</>;
    }
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-destructive text-center">
        <p className="mb-4">{error}</p>
        {onRetry && (
          <Button onClick={onRetry} variant="outline">
            {tc("retry")}
          </Button>
        )}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>{emptyMessage ?? tc("noData")}</p>
      </div>
    );
  }

  return <>{children}</>;
}
