"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useTranslations } from "next-intl";

interface AdminDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  trigger?: React.ReactNode;
  saving: boolean;
  disabled?: boolean;
  onSave: () => void;
  className?: string;
  children: React.ReactNode;
}

export function AdminDialog({
  open,
  onOpenChange,
  title,
  trigger,
  saving,
  disabled,
  onSave,
  className,
  children,
}: AdminDialogProps) {
  const tc = useTranslations("common");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className={`bg-card border-border ${className ?? ""}`}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {children}
          <Button
            onClick={onSave}
            disabled={saving || disabled}
            className="w-full bg-primary"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {tc("save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
