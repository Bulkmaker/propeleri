import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  Users,
  Swords,
  CalendarDays,
  Trophy,
  Camera,
  Megaphone,
  LayoutDashboard,
  ShieldCheck,
} from "lucide-react";

const adminLinks = [
  { href: "/admin", icon: LayoutDashboard, key: "dashboard" },
  { href: "/admin/players", icon: Users, key: "managePlayers" },
  { href: "/admin/games", icon: Swords, key: "manageGames" },
  { href: "/admin/training", icon: CalendarDays, key: "manageTraining" },
  { href: "/admin/seasons", icon: Trophy, key: "manageSeasons" },
  { href: "/admin/events", icon: Megaphone, key: "manageEvents" },
  { href: "/admin/gallery", icon: Camera, key: "manageGallery" },
] as const;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("app_role, team_role")
    .eq("id", user.id)
    .single();

  if (
    !profile ||
    (profile.app_role !== "admin" &&
      !["captain", "assistant_captain"].includes(profile.team_role))
  ) {
    redirect("/");
  }

  return <AdminShell isAdmin={profile.app_role === "admin"}>{children}</AdminShell>;
}

function AdminShell({
  children,
  isAdmin,
}: {
  children: React.ReactNode;
  isAdmin: boolean;
}) {
  const t = useTranslations("admin");

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border/40 bg-card/50 hidden md:block">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-6 px-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
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

      {/* Content */}
      <div className="flex-1 p-6">{children}</div>
    </div>
  );
}
