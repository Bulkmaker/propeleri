"use client";

import { useEffect, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
    Users,
    Shield,
    Swords,
    CalendarDays,
    Trophy,
    Camera,
    Megaphone,
    LayoutDashboard,
    Award,
    Menu,
} from "lucide-react";
import Image from "next/image";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const adminLinks = [
    { href: "/admin", icon: LayoutDashboard, key: "dashboard" },
    { href: "/admin/players", icon: Users, key: "managePlayers" },
    { href: "/admin/teams", icon: Shield, key: "manageTeams" },
    { href: "/admin/games", icon: Swords, key: "manageGames" },
    { href: "/admin/training", icon: CalendarDays, key: "manageTraining" },
    { href: "/admin/seasons", icon: Trophy, key: "manageSeasons" },
    { href: "/admin/tournaments", icon: Award, key: "manageTournaments" },
    { href: "/admin/events", icon: Megaphone, key: "manageEvents" },
    { href: "/admin/gallery", icon: Camera, key: "manageGallery" },
] as const;

interface AdminSidebarContentProps {
    isAdmin: boolean;
    pathname: string;
    t: (key: string) => string;
    onNavigate?: () => void;
}

function AdminSidebarContent({
    isAdmin,
    pathname,
    t,
    onNavigate,
}: AdminSidebarContentProps) {
    return (
        <div className="flex h-full flex-col gap-4">
            <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
                <Link href="/" className="flex items-center gap-2 font-semibold" onClick={onNavigate}>
                    <Image src="/logo.svg" alt="HC Propeleri" width={24} height={24} />
                    <span className="">{t("dashboard")}</span>
                </Link>
            </div>
            <div className="flex-1">
                <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
                    {adminLinks.map((link) => {
                        if (!isAdmin && link.key === "manageSeasons") {
                            return null;
                        }
                        const isActive = pathname === link.href;
                        return (
                            <Link
                                key={link.key}
                                href={link.href}
                                onClick={onNavigate}
                                className={cn(
                                    "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary",
                                    isActive
                                        ? "bg-muted text-primary"
                                        : "text-muted-foreground"
                                )}
                            >
                                <link.icon className="h-4 w-4" />
                                {t(link.key)}
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </div>
    );
}

export default function AdminShell({
    children,
    isAdmin,
}: {
    children: React.ReactNode;
    isAdmin: boolean;
}) {
    const t = useTranslations("admin");
    const pathname = usePathname();
    const [open, setOpen] = useState(false);

    // Lock body scroll, hide footer, constrain outer main so inner scroll works
    useEffect(() => {
        const body = document.body;
        const mainContent = document.getElementById("main-content");
        const footer = mainContent?.nextElementSibling as HTMLElement | null;

        body.style.height = "100dvh";
        body.style.overflow = "hidden";
        if (mainContent) {
            mainContent.style.overflow = "hidden";
            mainContent.style.minHeight = "0";
        }
        if (footer?.tagName === "FOOTER") footer.style.display = "none";

        return () => {
            body.style.height = "";
            body.style.overflow = "";
            if (mainContent) {
                mainContent.style.overflow = "";
                mainContent.style.minHeight = "";
            }
            if (footer?.tagName === "FOOTER") footer.style.display = "";
        };
    }, []);

    return (
        <div className="flex h-full w-full overflow-hidden">
            {/* Desktop Sidebar */}
            <aside className="hidden border-r bg-muted/40 md:block fixed top-16 left-0 h-[calc(100vh-4rem)] w-[220px] lg:w-[280px] z-30 overflow-y-auto">
                <AdminSidebarContent
                    isAdmin={isAdmin}
                    pathname={pathname}
                    t={t}
                    onNavigate={() => setOpen(false)}
                />
            </aside>

            {/* Mobile Header & Content */}
            <div className="flex-1 flex flex-col md:ml-[220px] lg:ml-[280px] overflow-hidden">
                {/* Mobile Header */}
                <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 md:hidden shrink-0">
                    <Sheet open={open} onOpenChange={setOpen}>
                        <SheetTrigger asChild>
                            <Button
                                variant="outline"
                                size="icon"
                                className="shrink-0"
                            >
                                <Menu className="h-5 w-5" />
                                <span className="sr-only">Toggle navigation menu</span>
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="flex flex-col p-0 w-[280px]">
                            <SheetTitle className="sr-only">{t("dashboard")}</SheetTitle>
                            <AdminSidebarContent
                                isAdmin={isAdmin}
                                pathname={pathname}
                                t={t}
                                onNavigate={() => setOpen(false)}
                            />
                        </SheetContent>
                    </Sheet>
                    <div className="flex items-center gap-2 font-semibold">
                        <span className="">{t("dashboard")}</span>
                    </div>
                </header>

                {/* Main Content — scrollable area */}
                <main className="flex-1 overflow-y-auto pb-20">
                    {children}
                </main>
            </div>
        </div>
    );
}
