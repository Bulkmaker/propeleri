import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Users } from "lucide-react";
import type { Profile } from "@/types/database";
import RosterClient from "@/components/roster/RosterClient";

export default async function RosterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("roster");

  const supabase = await createClient();
  const { data: players } = await supabase
    .from("profiles")
    .select("*")
    .eq("is_active", true)
    .eq("is_approved", true)
    .order("jersey_number", { ascending: true });

  const allPlayers = (players ?? []) as Profile[];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
      </div>

      {allPlayers.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>Nema registrovanih igraca</p>
        </div>
      ) : (
        <RosterClient players={allPlayers} />
      )}
    </div>
  );
}
