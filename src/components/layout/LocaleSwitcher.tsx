"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";
import { routing } from "@/i18n/routing";

const localeFlags: Record<string, string> = {
  sr: "🇷🇸",
  ru: "🇷🇺",
  en: "🇬🇧",
};

export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations("locale");
  const router = useRouter();
  const pathname = usePathname();

  function handleLocaleChange(newLocale: string) {
    router.replace(pathname, { locale: newLocale });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          data-testid="locale-switcher-trigger"
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <Globe className="h-4 w-4" />
          <span className="text-xs uppercase">{locale}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-card border-border">
        {routing.locales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            data-testid={`locale-option-${loc}`}
            data-locale={loc}
            onClick={() => handleLocaleChange(loc)}
            className={`cursor-pointer ${loc === locale ? "text-primary" : ""}`}
          >
            <span className="mr-2">{localeFlags[loc]}</span>
            {t(loc)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
