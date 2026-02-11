"use client";

import { Link } from "@/i18n/navigation";
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
} from "lucide-react";
import Image from "next/image";

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

export default function AdminShell({
    children,
    isAdmin,
}: {
    children: React.ReactNode;
    isAdmin: boolean;
}) {
    const t = useTranslations("admin");

    return (
        <div className="flex h-[calc(100vh-4rem)]">
            {/* Sidebar — fixed, does not scroll with content */}
            <aside className="w-64 shrink-0 border-r border-border/40 bg-card/50 hidden md:block overflow-y-auto">
                <div className="p-4">
                    <div className="flex items-center gap-2 mb-6 px-2">
                        <Image src="/logo.svg" alt="HC Propeleri" width={24} height={24} />
                        <span className="font-bold text-sm">{t("dashboard")}</span>
                    </div>
                    <nav className="space-y-1">
                        {adminLinks.map((link) => {
                            // Hide season management for non-admins
                            if (
                                !isAdmin &&
                                (link.key === "manageSeasons")
                            ) {
                                return null;
                            }
                            return (
                                <Link
                                    key={link.key}
                                    href={link.href}
                                    className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                                >
                                    <link.icon className="h-4 w-4" />
                                    {t(link.key)}
                                </Link>
                            );
                        })}
                    </nav>
                </div>
            </aside>

            {/* Content — scrolls independently */}
            <div className="flex-1 overflow-y-auto">{children}</div>
        </div>
    );
}
