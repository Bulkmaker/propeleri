import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Users } from "lucide-react";
import type { Profile } from "@/types/database";
import RosterClient from "@/components/roster/RosterClient";
import { PageHeader } from "@/components/ui/page-header";

export const revalidate = 600;

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
      <PageHeader title={t("title")} icon={Users} />

      {allPlayers.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>Nema registrovanih igraca</p>
        </div>
      ) : (
        <RosterClient players={allPlayers} />
      )
      }
    </div>
  );
}
