"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle, XCircle, Users, Loader2 } from "lucide-react";
import type { Profile, PlayerRole, AppRole, PlayerPosition } from "@/types/database";
import { POSITION_COLORS } from "@/lib/utils/constants";

export default function AdminPlayersPage() {
  const t = useTranslations("admin");
  const tp = useTranslations("positions");
  const tr = useTranslations("roles");
  const tc = useTranslations("common");

  const [players, setPlayers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadPlayers();
  }, []);

  async function loadPlayers() {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("is_approved", { ascending: true })
      .order("last_name", { ascending: true });
    setPlayers(data ?? []);
    setLoading(false);
  }

  async function approvePlayer(id: string) {
    await supabase.from("profiles").update({ is_approved: true }).eq("id", id);
    loadPlayers();
  }

  async function updateRole(id: string, field: string, value: string) {
    await supabase
      .from("profiles")
      .update({ [field]: value })
      .eq("id", id);
    loadPlayers();
  }

  async function toggleActive(id: string, isActive: boolean) {
    await supabase
      .from("profiles")
      .update({ is_active: !isActive })
      .eq("id", id);
    loadPlayers();
  }

  const pending = players.filter((p) => !p.is_approved);
  const approved = players.filter((p) => p.is_approved);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("managePlayers")}</h1>

      {/* Pending Approvals */}
      {pending.length > 0 && (
        <Card className="border-yellow-500/20 mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {t("pendingApprovals")}
              <Badge className="bg-yellow-500/20 text-yellow-500">
                {pending.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pending.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between py-3 px-4 rounded-md bg-secondary/50"
                >
                  <div>
                    <p className="font-medium">
                      {player.first_name} {player.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {player.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => approvePlayer(player.id)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      {t("approve")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Players */}
      <Card className="border-border/40">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {t("activePlayers")} ({approved.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Player</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Team Role</TableHead>
                <TableHead>App Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {approved.map((player) => (
                <TableRow key={player.id}>
                  <TableCell className="text-primary font-bold">
                    {player.jersey_number ?? "-"}
                  </TableCell>
                  <TableCell className="font-medium">
                    {player.first_name} {player.last_name}
                    <br />
                    <span className="text-xs text-muted-foreground">
                      {player.email}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${POSITION_COLORS[player.position as PlayerPosition]}`}>
                      {tp(player.position)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={player.team_role}
                      onValueChange={(v) =>
                        updateRole(player.id, "team_role", v)
                      }
                    >
                      <SelectTrigger className="w-[160px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="player">{tr("player")}</SelectItem>
                        <SelectItem value="captain">{tr("captain")}</SelectItem>
                        <SelectItem value="assistant_captain">
                          {tr("assistantCaptain")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={player.app_role}
                      onValueChange={(v) =>
                        updateRole(player.id, "app_role", v)
                      }
                    >
                      <SelectTrigger className="w-[120px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="player">Player</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {player.is_active ? (
                      <Badge className="bg-green-600/20 text-green-400">Active</Badge>
                    ) : (
                      <Badge className="bg-red-600/20 text-red-400">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        toggleActive(player.id, player.is_active)
                      }
                    >
                      {player.is_active ? (
                        <XCircle className="h-4 w-4 text-red-400" />
                      ) : (
                        <CheckCircle className="h-4 w-4 text-green-400" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
