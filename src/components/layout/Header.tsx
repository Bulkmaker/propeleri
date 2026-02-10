"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { Menu, X } from "lucide-react";

const navLinks = [
  { href: "/roster", key: "roster" },
  { href: "/schedule", key: "schedule" },
  { href: "/games", key: "games" },
  { href: "/stats", key: "stats" },
  { href: "/gallery", key: "gallery" },
  { href: "/events", key: "events" },
] as const;

export function Header() {
  const t = useTranslations("common");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-lg group-hover:bg-primary/20 transition-colors">
            P
          </div>
          <span className="text-lg font-bold hidden sm:block">
            HC <span className="text-primary">Propeleri</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.key}
                href={link.href}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                {t(link.key)}
              </Link>
            );
          })}
        </nav>

        {/* Right side: locale switcher + auth + mobile menu */}
        <div className="flex items-center gap-2">
          <LocaleSwitcher />

          <Link href="/login" className="hidden md:block">
            <Button variant="outline" size="sm" className="border-primary/30 hover:bg-primary/10 hover:text-primary">
              {t("login")}
            </Button>
          </Link>

          {/* Mobile menu */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-background border-border">
              <nav className="flex flex-col gap-1 mt-8">
                {navLinks.map((link) => {
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.key}
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className={`px-4 py-3 text-sm font-medium rounded-md transition-colors ${
                        isActive
                          ? "text-primary bg-primary/10"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent"
                      }`}
                    >
                      {t(link.key)}
                    </Link>
                  );
                })}
                <div className="border-t border-border my-2" />
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="px-4 py-3 text-sm font-medium text-primary hover:bg-primary/10 rounded-md"
                >
                  {t("login")}
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
