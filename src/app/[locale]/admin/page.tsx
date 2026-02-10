import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Swords, CalendarDays, UserCheck } from "lucide-react";

export default async function AdminDashboardPage() {
  const t = useTranslations("admin");

  const supabase = await createClient();

  const { count: playerCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true)
    .eq("is_approved", true);

  const { count: pendingCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("is_approved", false);

  const { count: gameCount } = await supabase
    .from("games")
    .select("*", { count: "exact", head: true });

  const { count: trainingCount } = await supabase
    .from("training_sessions")
    .select("*", { count: "exact", head: true });

  // Pending approvals
  const { data: pendingUsers } = await supabase
    .from("profiles")
    .select("*")
    .eq("is_approved", false)
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("dashboard")}</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="border-border/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{playerCount ?? 0}</p>
                <p className="text-xs text-muted-foreground">
                  {t("activePlayers")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <UserCheck className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingCount ?? 0}</p>
                <p className="text-xs text-muted-foreground">
                  {t("pendingApprovals")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Swords className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{gameCount ?? 0}</p>
                <p className="text-xs text-muted-foreground">
                  {t("totalGames")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <CalendarDays className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{trainingCount ?? 0}</p>
                <p className="text-xs text-muted-foreground">
                  {t("totalTrainings")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Approvals */}
      {pendingUsers && pendingUsers.length > 0 && (
        <Card className="border-yellow-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-yellow-500" />
              {t("pendingApprovals")}
              <Badge className="bg-yellow-500/20 text-yellow-500 ml-2">
                {pendingUsers.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingUsers.map((user: any) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between py-2 px-3 rounded-md bg-secondary/50"
                >
                  <div>
                    <p className="font-medium text-sm">
                      {user.first_name} {user.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">
                    {t("pendingApprovals")}
                  </Badge>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Idi na &quot;Upravljanje igracima&quot; za odobravanje
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
