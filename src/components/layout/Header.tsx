"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { useUser } from "@/hooks/use-user";
import { createClient } from "@/lib/supabase/client";
import { Menu, User, Shield, LogOut } from "lucide-react";

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
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { user, profile, loading, isAdmin, isTeamLeader } = useUser();

  const initials = profile
    ? `${profile.first_name?.[0] ?? ""}${profile.last_name?.[0] ?? ""}`
    : "";

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

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

          {/* Desktop auth */}
          <div className="hidden md:block">
            {loading ? null : user && profile ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2 hover:bg-accent">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={profile.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium max-w-30 truncate">
                      {profile.first_name}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="flex items-center gap-2 cursor-pointer">
                      <User className="h-4 w-4" />
                      {t("profile")}
                    </Link>
                  </DropdownMenuItem>
                  {(isAdmin || isTeamLeader) && (
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="flex items-center gap-2 cursor-pointer">
                        <Shield className="h-4 w-4" />
                        {t("admin")}
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="h-4 w-4" />
                    {t("logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href="/login">
                <Button variant="outline" size="sm" className="border-primary/30 hover:bg-primary/10 hover:text-primary">
                  {t("login")}
                </Button>
              </Link>
            )}
          </div>

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
                {user && profile ? (
                  <>
                    <Link
                      href="/profile"
                      onClick={() => setOpen(false)}
                      className="px-4 py-3 text-sm font-medium text-foreground hover:bg-accent rounded-md flex items-center gap-2"
                    >
                      <User className="h-4 w-4" />
                      {t("profile")}
                    </Link>
                    {(isAdmin || isTeamLeader) && (
                      <Link
                        href="/admin"
                        onClick={() => setOpen(false)}
                        className="px-4 py-3 text-sm font-medium text-foreground hover:bg-accent rounded-md flex items-center gap-2"
                      >
                        <Shield className="h-4 w-4" />
                        {t("admin")}
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        handleLogout();
                        setOpen(false);
                      }}
                      className="px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-md text-left flex items-center gap-2"
                    >
                      <LogOut className="h-4 w-4" />
                      {t("logout")}
                    </button>
                  </>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="px-4 py-3 text-sm font-medium text-primary hover:bg-primary/10 rounded-md"
                  >
                    {t("login")}
                  </Link>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
