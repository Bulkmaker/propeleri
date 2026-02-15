"use client";

import { useState, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Link2, RefreshCw, Check, X } from "lucide-react";
import { slugify } from "@/lib/utils/match-slug";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface SlugFieldProps {
  value: string;
  onChange: (slug: string) => void;
  onRegenerate?: () => void;
  table: string;
  excludeId?: string;
  baseUrl: string;
  label?: string;
}

export function SlugField({
  value,
  onChange,
  onRegenerate,
  table,
  excludeId,
  baseUrl,
  label = "Slug",
}: SlugFieldProps) {
  const [status, setStatus] = useState<"idle" | "checking" | "valid" | "taken">("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkUniqueness = useCallback(
    async (slug: string) => {
      if (!slug) {
        setStatus("idle");
        return;
      }
      setStatus("checking");
      const supabase = createClient();
      let query = supabase.from(table).select("id").eq("slug", slug).limit(1);
      if (excludeId) query = query.neq("id", excludeId);
      const { data } = await query;
      setStatus(data && data.length > 0 ? "taken" : "valid");
    },
    [table, excludeId]
  );

  const handleChange = (raw: string) => {
    const cleaned = slugify(raw) || raw.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/-{2,}/g, "-");
    onChange(cleaned);
    setStatus("idle");

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (cleaned) checkUniqueness(cleaned);
    }, 500);
  };

  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5">
        <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
        {label}
      </Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="auto-generated-slug"
            className={cn(
              "pr-8 font-mono text-xs",
              status === "taken" && "border-destructive",
              status === "valid" && "border-green-500"
            )}
          />
          {status === "checking" && (
            <RefreshCw className="absolute right-2.5 top-2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
          {status === "valid" && (
            <Check className="absolute right-2.5 top-2 h-4 w-4 text-green-500" />
          )}
          {status === "taken" && (
            <X className="absolute right-2.5 top-2 h-4 w-4 text-destructive" />
          )}
        </div>
        {onRegenerate && (
          <Button type="button" variant="outline" size="icon" onClick={onRegenerate} title="Regenerate">
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground font-mono truncate">
        {baseUrl}/{value || "..."}
      </p>
      {status === "taken" && (
        <p className="text-xs text-destructive">This slug is already taken</p>
      )}
    </div>
  );
}
