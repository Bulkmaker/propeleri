"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "@/i18n/navigation";
import { ChevronLeft, Loader2, Save, UserPlus, X } from "lucide-react";
import type { Profile, PlayerPosition, LineupDesignation } from "@/types/database";
import { POSITION_COLORS } from "@/lib/utils/constants";
import HockeyRink from "@/components/games/HockeyRink";

interface LineupEntry {
  player_id: string;
  designation: LineupDesignation;
  position_played: PlayerPosition;
  player: Profile;
}

export default function LineupPage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const t = useTranslations("game");
  const tp = useTranslations("positions");
  const tr = useTranslations("roles");
  const tc = useTranslations("common");

  const [players, setPlayers] = useState<Profile[]>([]);
  const [lineup, setLineup] = useState<LineupEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const [playersRes, lineupRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .eq("is_active", true)
          .eq("is_approved", true)
          .order("jersey_number"),
        supabase
          .from("game_lineups")
          .select("*, player:profiles(*)")
          .eq("game_id", gameId),
      ]);

      setPlayers(playersRes.data ?? []);
      setLineup(
        (lineupRes.data ?? []).map((entry: any) => ({
          player_id: entry.player_id,
          designation: entry.designation,
          position_played: entry.position_played,
          player: entry.player,
        }))
      );
      setLoading(false);
    }
    load();
  }, [gameId]);

  function addPlayer(player: Profile) {
    if (lineup.find((l) => l.player_id === player.id)) return;
    setLineup([
      ...lineup,
      {
        player_id: player.id,
        designation: "player",
        position_played: player.position,
        player,
      },
    ]);
  }

  function removePlayer(playerId: string) {
    setLineup(lineup.filter((l) => l.player_id !== playerId));
  }

  function updateDesignation(playerId: string, designation: LineupDesignation) {
    setLineup(
      lineup.map((l) =>
        l.player_id === playerId ? { ...l, designation } : l
      )
    );
  }

  function updatePosition(playerId: string, position: PlayerPosition) {
    setLineup(
      lineup.map((l) =>
        l.player_id === playerId ? { ...l, position_played: position } : l
      )
    );
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");

    // Delete existing lineup
    await supabase.from("game_lineups").delete().eq("game_id", gameId);

    // Insert new lineup
    const entries = lineup.map((l) => ({
      game_id: gameId,
      player_id: l.player_id,
      designation: l.designation,
      position_played: l.position_played,
    }));

    if (entries.length > 0) {
      await supabase.from("game_lineups").insert(entries);
    }

    setMessage("Postava sacuvana!");
    setSaving(false);
  }

  const availablePlayers = players.filter(
    (p) => !lineup.find((l) => l.player_id === p.id)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Link
        href={`/games/${gameId}`}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        {tc("back")}
      </Link>

      <h1 className="text-2xl font-bold mb-6">{t("selectLineup")}</h1>

      {/* Rink Preview */}
      {lineup.length > 0 && (
        <Card className="border-border/40 mb-6">
          <CardHeader>
            <CardTitle className="text-lg">{t("rinkView")}</CardTitle>
          </CardHeader>
          <CardContent>
            <HockeyRink lineup={lineup} interactive />
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Current Lineup */}
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">
              {t("lineup")} ({lineup.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lineup.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Izaberite igrace iz liste desno
              </p>
            ) : (
              <div className="space-y-2">
                {lineup.map((entry) => (
                  <div
                    key={entry.player_id}
                    className="flex items-center justify-between py-2 px-3 rounded-md bg-secondary/50"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-primary font-bold text-sm">
                        #{entry.player.jersey_number ?? "-"}
                      </span>
                      <span className="text-sm font-medium">
                        {entry.player.first_name} {entry.player.last_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Select
                        value={entry.position_played}
                        onValueChange={(v) =>
                          updatePosition(entry.player_id, v as PlayerPosition)
                        }
                      >
                        <SelectTrigger className="w-[100px] h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="forward">{tp("forward")}</SelectItem>
                          <SelectItem value="defense">{tp("defense")}</SelectItem>
                          <SelectItem value="goalie">{tp("goalie")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value={entry.designation}
                        onValueChange={(v) =>
                          updateDesignation(
                            entry.player_id,
                            v as LineupDesignation
                          )
                        }
                      >
                        <SelectTrigger className="w-[80px] h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="player">-</SelectItem>
                          <SelectItem value="captain">C</SelectItem>
                          <SelectItem value="assistant_captain">A</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => removePlayer(entry.player_id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {message && (
              <p className="text-sm text-green-400 bg-green-400/10 border border-green-400/20 rounded-md px-3 py-2 mt-4">
                {message}
              </p>
            )}

            <Button
              onClick={handleSave}
              disabled={saving}
              className="mt-4 w-full bg-primary"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {tc("save")}
            </Button>
          </CardContent>
        </Card>

        {/* Available Players */}
        <Card className="border-border/40">
          <CardHeader>
            <CardTitle className="text-lg">
              Dostupni igraci ({availablePlayers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {availablePlayers.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => addPlayer(player)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-primary font-bold text-sm">
                      #{player.jersey_number ?? "-"}
                    </span>
                    <span className="text-sm">
                      {player.first_name} {player.last_name}
                    </span>
                    <Badge
                      variant="secondary"
                      className={`text-xs ${POSITION_COLORS[player.position as PlayerPosition]}`}
                    >
                      {tp(player.position)}
                    </Badge>
                  </div>
                  <UserPlus className="h-4 w-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
