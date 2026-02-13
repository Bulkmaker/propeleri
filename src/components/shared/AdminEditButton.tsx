"use client";

import { useUser } from "@/hooks/use-user";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminEditButtonProps {
  href: string;
  variant?: "icon" | "button";
  className?: string;
}

export function AdminEditButton({
  href,
  variant = "icon",
  className,
}: AdminEditButtonProps) {
  const { isAdmin, isTeamLeader } = useUser();
  const tc = useTranslations("common");

  if (!isAdmin && !isTeamLeader) return null;

  if (variant === "button") {
    return (
      <Button variant="outline" size="sm" asChild className={className}>
        <Link href={href}>
          <Pencil className="h-4 w-4 mr-2" />
          {tc("edit")}
        </Link>
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      asChild
      className={cn(
        "text-muted-foreground hover:text-primary hover:bg-primary/10",
        className
      )}
    >
      <Link href={href} aria-label={tc("edit")}>
        <Pencil className="h-3 w-3" />
      </Link>
    </Button>
  );
}
