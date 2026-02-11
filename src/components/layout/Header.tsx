"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import dynamic from "next/dynamic";
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
import { useUser } from "@/hooks/use-user";
import { Menu, User, Shield, LogOut } from "lucide-react";
import Image from "next/image";

const LocaleSwitcher = dynamic(
  () => import("./LocaleSwitcher").then((mod) => mod.LocaleSwitcher),
  { ssr: false }
);

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
  const { user, profile, loading, isAdmin, isTeamLeader, supabase } = useUser();

  const initials = profile
    ? `${profile.first_name?.[0] ?? ""}${profile.last_name?.[0] ?? ""}`
    : user?.email?.[0]?.toUpperCase() ?? "";

  const displayName = profile?.first_name || user?.email?.split("@")[0] || "";

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <Image
            src="/logo.svg"
            alt="HC Propeleri"
            width={40}
            height={40}
            className="group-hover:scale-105 transition-transform"
          />
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
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${isActive
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
            {loading ? (
              <Button variant="outline" size="sm" disabled className="border-primary/30">
                {t("login")}
              </Button>
            ) : user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2 hover:bg-accent">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={profile?.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium max-w-30 truncate">
                      {displayName}
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
                      className={`px-4 py-3 text-sm font-medium rounded-md transition-colors ${isActive
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                        }`}
                    >
                      {t(link.key)}
                    </Link>
                  );
                })}
                <div className="border-t border-border my-2" />
                {user ? (
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

      {/* Mobile Horizontal Navigation */}
      <div className="md:hidden border-t border-border/10">
        <div className="container mx-auto">
          <nav className="flex items-center gap-6 overflow-x-auto px-4 py-3 no-scrollbar scroll-smooth">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.key}
                  href={link.href}
                  className={`whitespace-nowrap text-[11px] font-bold uppercase tracking-widest transition-colors ${isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  {t(link.key)}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
