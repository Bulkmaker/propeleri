"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "@/i18n/navigation";
import {
  ChevronLeft,
  Loader2,
  Plus,
  Trash2,
  Users,
  Layers,
  Swords,
  Check,
  MapPin,
  Globe,
} from "lucide-react";
import type {
  Tournament,
  Team,
  TournamentTeam,
  TournamentGroup,
  TournamentGroupTeam,
  TournamentMatch,
  TournamentMatchStage,
  Game,
} from "@/types/database";

export default function AdminTournamentDetailPage() {
  const params = useParams();
  const tournamentId = params.id as string;
  const tt = useTranslations("tournament");
  const tc = useTranslations("common");

  const supabase = createClient();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  // Teams in this tournament (resolved from junction)
  const [teams, setTeams] = useState<Team[]>([]);
  // All global teams (for "add existing" select)
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [tournamentTeamJunctions, setTournamentTeamJunctions] = useState<
    TournamentTeam[]
  >([]);
  const [groups, setGroups] = useState<TournamentGroup[]>([]);
  const [groupTeams, setGroupTeams] = useState<TournamentGroupTeam[]>([]);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  // Team dialog
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [teamMode, setTeamMode] = useState<"new" | "existing">("existing");
  const [teamForm, setTeamForm] = useState({
    name: "",
    city: "",
    country: "Serbia",
    is_propeleri: false,
  });
  const [selectedExistingTeamId, setSelectedExistingTeamId] = useState("");

  // Group dialog
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: "" });

  // Match dialog
  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [matchForm, setMatchForm] = useState({
    team_a_id: "",
    team_b_id: "",
    stage: "group" as TournamentMatchStage,
    match_date: "",
    bracket_label: "",
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    const [tRes, ttRes, allTeamsRes, groupsRes, gtRes, matchesRes, gamesRes] =
      await Promise.all([
        supabase
          .from("tournaments")
          .select("*")
          .eq("id", tournamentId)
          .single(),
        supabase
          .from("tournament_teams")
          .select("*")
          .eq("tournament_id", tournamentId)
          .order("sort_order"),
        supabase.from("teams").select("*").order("name"),
        supabase
          .from("tournament_groups")
          .select("*")
          .eq("tournament_id", tournamentId)
          .order("sort_order"),
        supabase.from("tournament_group_teams").select("*"),
        supabase
          .from("tournament_matches")
          .select("*")
          .eq("tournament_id", tournamentId)
          .order("match_date", { ascending: true }),
        supabase
          .from("games")
          .select("*")
          .eq("tournament_id", tournamentId)
          .order("game_date", { ascending: true }),
      ]);

    setTournament(tRes.data);

    const junctions: TournamentTeam[] = ttRes.data ?? [];
    setTournamentTeamJunctions(junctions);

    const global: Team[] = allTeamsRes.data ?? [];
    setAllTeams(global);

    // Resolve tournament teams from junctions
    const teamIds = new Set(junctions.map((j) => j.team_id));
    setTeams(global.filter((t) => teamIds.has(t.id)));

    setGroups(groupsRes.data ?? []);

    const groupIds = new Set((groupsRes.data ?? []).map((g) => g.id));
    setGroupTeams(
      (gtRes.data ?? []).filter((gt) => groupIds.has(gt.group_id))
    );

    setMatches(matchesRes.data ?? []);
    setGames(gamesRes.data ?? []);
    setLoading(false);
  }

  // --- TEAMS ---
  async function addTeam() {
    setSaving(true);

    let teamId: string;

    if (teamMode === "existing" && selectedExistingTeamId) {
      teamId = selectedExistingTeamId;
    } else {
      // Create new team in global teams table
      const { data } = await supabase
        .from("teams")
        .insert({
          name: teamForm.name,
          city: teamForm.city || null,
          country: teamForm.country || null,
          is_propeleri: teamForm.is_propeleri,
        })
        .select("id")
        .single();

      if (!data) {
        setSaving(false);
        return;
      }
      teamId = data.id;
    }

    // Link to tournament
    await supabase.from("tournament_teams").insert({
      tournament_id: tournamentId,
      team_id: teamId,
      sort_order: teams.length,
    });

    setTeamDialogOpen(false);
    setTeamForm({ name: "", city: "", country: "Serbia", is_propeleri: false });
    setSelectedExistingTeamId("");
    setSaving(false);
    loadAll();
  }

  async function removeTeamFromTournament(teamId: string) {
    const junction = tournamentTeamJunctions.find(
      (j) => j.team_id === teamId
    );
    if (junction) {
      await supabase
        .from("tournament_teams")
        .delete()
        .eq("id", junction.id);
    }
    loadAll();
  }

  // --- GROUPS ---
  async function addGroup() {
    setSaving(true);
    await supabase.from("tournament_groups").insert({
      tournament_id: tournamentId,
      name: groupForm.name,
      sort_order: groups.length,
    });
    setGroupDialogOpen(false);
    setGroupForm({ name: "" });
    setSaving(false);
    loadAll();
  }

  async function deleteGroup(id: string) {
    await supabase.from("tournament_groups").delete().eq("id", id);
    loadAll();
  }

  async function toggleTeamInGroup(groupId: string, teamId: string) {
    const existing = groupTeams.find(
      (gt) => gt.group_id === groupId && gt.team_id === teamId
    );
    if (existing) {
      await supabase
        .from("tournament_group_teams")
        .delete()
        .eq("id", existing.id);
    } else {
      await supabase
        .from("tournament_group_teams")
        .insert({ group_id: groupId, team_id: teamId });
    }
    loadAll();
  }

  // --- MATCHES ---
  function findGroupForMatch(
    teamAId: string,
    teamBId: string
  ): string | null {
    for (const group of groups) {
      const gTeamIds = groupTeams
        .filter((gt) => gt.group_id === group.id)
        .map((gt) => gt.team_id);
      if (gTeamIds.includes(teamAId) && gTeamIds.includes(teamBId)) {
        return group.id;
      }
    }
    return null;
  }

  async function addMatch() {
    setSaving(true);
    const groupId =
      matchForm.stage === "group"
        ? findGroupForMatch(matchForm.team_a_id, matchForm.team_b_id)
        : null;

    await supabase.from("tournament_matches").insert({
      tournament_id: tournamentId,
      team_a_id: matchForm.team_a_id,
      team_b_id: matchForm.team_b_id,
      stage: matchForm.stage,
      group_id: groupId,
      match_date: matchForm.match_date || null,
      bracket_label: matchForm.bracket_label || null,
    });

    setMatchDialogOpen(false);
    setMatchForm({
      team_a_id: "",
      team_b_id: "",
      stage: "group",
      match_date: "",
      bracket_label: "",
    });
    setSaving(false);
    loadAll();
  }

  async function updateMatchScore(
    matchId: string,
    scoreA: number,
    scoreB: number
  ) {
    await supabase
      .from("tournament_matches")
      .update({ score_a: scoreA, score_b: scoreB })
      .eq("id", matchId);
    loadAll();
  }

  async function markMatchCompleted(matchId: string) {
    await supabase
      .from("tournament_matches")
      .update({ is_completed: true })
      .eq("id", matchId);
    loadAll();
  }

  async function deleteMatch(id: string) {
    await supabase.from("tournament_matches").delete().eq("id", id);
    loadAll();
  }

  async function linkMatchToGame(matchId: string, gameId: string) {
    await supabase
      .from("tournament_matches")
      .update({ game_id: gameId === "__none__" ? null : gameId })
      .eq("id", matchId);
    loadAll();
  }

  function teamName(id: string) {
    return teams.find((t) => t.id === id)?.name ?? "?";
  }

  function isTeamPropeleri(id: string) {
    return teams.find((t) => t.id === id)?.is_propeleri ?? false;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Tournament not found
      </div>
    );
  }

  // Teams not yet in this tournament (for "add existing" select)
  const teamIdsInTournament = new Set(teams.map((t) => t.id));
  const availableTeams = allTeams.filter(
    (t) => !teamIdsInTournament.has(t.id)
  );

  const groupMatches = matches.filter((m) => m.stage === "group");
  const playoffMatches = matches.filter((m) => m.stage === "playoff");

  return (
    <div>
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/40 px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/tournaments">
            <Button size="icon" variant="ghost">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">{tournament.name}</h1>
            <p className="text-xs text-muted-foreground">
              {tournament.start_date} — {tournament.end_date}
            </p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <Tabs defaultValue="teams">
          <TabsList className="mb-4">
            <TabsTrigger value="teams" className="gap-2">
              <Users className="h-4 w-4" />
              {tt("teams")}
            </TabsTrigger>
            <TabsTrigger value="groups" className="gap-2">
              <Layers className="h-4 w-4" />
              {tt("groups")}
            </TabsTrigger>
            <TabsTrigger value="matches" className="gap-2">
              <Swords className="h-4 w-4" />
              {tt("matches")}
            </TabsTrigger>
          </TabsList>

          {/* === TEAMS TAB === */}
          <TabsContent value="teams">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{tt("teams")}</h2>
              <Button
                size="sm"
                onClick={() => {
                  setTeamMode(availableTeams.length > 0 ? "existing" : "new");
                  setTeamDialogOpen(true);
                }}
                className="bg-primary"
              >
                <Plus className="h-4 w-4 mr-1" />
                {tt("addTeam")}
              </Button>
            </div>

            {teams.length === 0 ? (
              <p className="text-muted-foreground text-center py-10">
                {tt("noTeams")}
              </p>
            ) : (
              <div className="space-y-2">
                {teams.map((team) => (
                  <Card key={team.id} className="border-border/40">
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {team.logo_url && (
                          <img
                            src={team.logo_url}
                            alt={team.name}
                            className="h-6 w-6 rounded object-contain"
                          />
                        )}
                        <span className="font-medium text-sm">
                          {team.name}
                        </span>
                        {team.is_propeleri && (
                          <Badge className="bg-primary/20 text-primary text-xs">
                            {tt("propeleri")}
                          </Badge>
                        )}
                        {(team.city || team.country) && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {[team.city, team.country]
                              .filter(Boolean)
                              .join(", ")}
                          </span>
                        )}
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-red-400 hover:text-red-300 h-8 w-8"
                        onClick={() => removeTeamFromTournament(team.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <Dialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen}>
              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle>{tt("addTeam")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {/* Toggle existing / new */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={teamMode === "existing" ? "default" : "outline"}
                      onClick={() => setTeamMode("existing")}
                      disabled={availableTeams.length === 0}
                    >
                      Existing
                    </Button>
                    <Button
                      size="sm"
                      variant={teamMode === "new" ? "default" : "outline"}
                      onClick={() => setTeamMode("new")}
                    >
                      New
                    </Button>
                  </div>

                  {teamMode === "existing" ? (
                    <div className="space-y-2">
                      <Label>{tt("teamName")}</Label>
                      <Select
                        value={selectedExistingTeamId || "__none__"}
                        onValueChange={(v) =>
                          setSelectedExistingTeamId(
                            v === "__none__" ? "" : v
                          )
                        }
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">—</SelectItem>
                          {availableTeams.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                              {t.city && ` (${t.city})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label>{tt("teamName")}</Label>
                        <Input
                          value={teamForm.name}
                          onChange={(e) =>
                            setTeamForm({ ...teamForm, name: e.target.value })
                          }
                          className="bg-background"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            City
                          </Label>
                          <Input
                            value={teamForm.city}
                            onChange={(e) =>
                              setTeamForm({
                                ...teamForm,
                                city: e.target.value,
                              })
                            }
                            className="bg-background"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            Country
                          </Label>
                          <Input
                            value={teamForm.country}
                            onChange={(e) =>
                              setTeamForm({
                                ...teamForm,
                                country: e.target.value,
                              })
                            }
                            className="bg-background"
                          />
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={teamForm.is_propeleri}
                          onChange={(e) =>
                            setTeamForm({
                              ...teamForm,
                              is_propeleri: e.target.checked,
                            })
                          }
                        />
                        {tt("propeleri")}
                      </label>
                    </>
                  )}

                  <Button
                    onClick={addTeam}
                    disabled={
                      saving ||
                      (teamMode === "new"
                        ? !teamForm.name
                        : !selectedExistingTeamId)
                    }
                    className="w-full bg-primary"
                  >
                    {saving && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {tc("save")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* === GROUPS TAB === */}
          <TabsContent value="groups">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{tt("groups")}</h2>
              <Button
                size="sm"
                onClick={() => setGroupDialogOpen(true)}
                className="bg-primary"
              >
                <Plus className="h-4 w-4 mr-1" />
                {tt("addGroup")}
              </Button>
            </div>

            {groups.length === 0 ? (
              <p className="text-muted-foreground text-center py-10">
                {tt("noGroups")}
              </p>
            ) : (
              <div className="space-y-4">
                {groups.map((group) => {
                  const memberIds = groupTeams
                    .filter((gt) => gt.group_id === group.id)
                    .map((gt) => gt.team_id);
                  return (
                    <Card key={group.id} className="border-border/40">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-medium">{group.name}</h3>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-red-400 hover:text-red-300 h-8 w-8"
                            onClick={() => deleteGroup(group.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {teams.map((team) => {
                            const isMember = memberIds.includes(team.id);
                            return (
                              <button
                                key={team.id}
                                onClick={() =>
                                  toggleTeamInGroup(group.id, team.id)
                                }
                                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                                  isMember
                                    ? "bg-primary/20 text-primary border-primary/40"
                                    : "bg-muted/30 text-muted-foreground border-border/40 hover:border-primary/40"
                                }`}
                              >
                                {team.name}
                                {isMember && (
                                  <Check className="inline h-3 w-3 ml-1" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle>{tt("addGroup")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{tt("groupName")}</Label>
                    <Input
                      value={groupForm.name}
                      onChange={(e) =>
                        setGroupForm({ ...groupForm, name: e.target.value })
                      }
                      className="bg-background"
                    />
                  </div>
                  <Button
                    onClick={addGroup}
                    disabled={saving || !groupForm.name}
                    className="w-full bg-primary"
                  >
                    {saving && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {tc("save")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* === MATCHES TAB === */}
          <TabsContent value="matches">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{tt("matches")}</h2>
              <Button
                size="sm"
                onClick={() => setMatchDialogOpen(true)}
                className="bg-primary"
                disabled={teams.length < 2}
              >
                <Plus className="h-4 w-4 mr-1" />
                {tt("addMatch")}
              </Button>
            </div>

            {matches.length === 0 ? (
              <p className="text-muted-foreground text-center py-10">
                {tt("noMatches")}
              </p>
            ) : (
              <div className="space-y-6">
                {groupMatches.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                      {tt("groupStage")}
                    </h3>
                    <div className="space-y-2">
                      {groupMatches.map((match) => (
                        <MatchCard
                          key={match.id}
                          match={match}
                          teamName={teamName}
                          isTeamPropeleri={isTeamPropeleri}
                          games={games}
                          groups={groups}
                          tt={tt}
                          onUpdateScore={updateMatchScore}
                          onMarkCompleted={markMatchCompleted}
                          onDelete={deleteMatch}
                          onLinkGame={linkMatchToGame}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {playoffMatches.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                      {tt("playoffStage")}
                    </h3>
                    <div className="space-y-2">
                      {playoffMatches.map((match) => (
                        <MatchCard
                          key={match.id}
                          match={match}
                          teamName={teamName}
                          isTeamPropeleri={isTeamPropeleri}
                          games={games}
                          groups={groups}
                          tt={tt}
                          onUpdateScore={updateMatchScore}
                          onMarkCompleted={markMatchCompleted}
                          onDelete={deleteMatch}
                          onLinkGame={linkMatchToGame}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <Dialog open={matchDialogOpen} onOpenChange={setMatchDialogOpen}>
              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle>{tt("addMatch")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{tt("stage")}</Label>
                    <Select
                      value={matchForm.stage}
                      onValueChange={(v) =>
                        setMatchForm({
                          ...matchForm,
                          stage: v as TournamentMatchStage,
                        })
                      }
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="group">
                          {tt("groupStage")}
                        </SelectItem>
                        <SelectItem value="playoff">
                          {tt("playoffStage")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{tt("selectTeamA")}</Label>
                      <Select
                        value={matchForm.team_a_id || "__none__"}
                        onValueChange={(v) =>
                          setMatchForm({
                            ...matchForm,
                            team_a_id: v === "__none__" ? "" : v,
                          })
                        }
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">—</SelectItem>
                          {teams.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{tt("selectTeamB")}</Label>
                      <Select
                        value={matchForm.team_b_id || "__none__"}
                        onValueChange={(v) =>
                          setMatchForm({
                            ...matchForm,
                            team_b_id: v === "__none__" ? "" : v,
                          })
                        }
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">—</SelectItem>
                          {teams
                            .filter((t) => t.id !== matchForm.team_a_id)
                            .map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{tt("matchDate")}</Label>
                    <Input
                      type="datetime-local"
                      value={matchForm.match_date}
                      onChange={(e) =>
                        setMatchForm({
                          ...matchForm,
                          match_date: e.target.value,
                        })
                      }
                      className="bg-background"
                    />
                  </div>
                  {matchForm.stage === "playoff" && (
                    <div className="space-y-2">
                      <Label>Label (e.g. {tt("firstSecond")})</Label>
                      <Input
                        value={matchForm.bracket_label}
                        onChange={(e) =>
                          setMatchForm({
                            ...matchForm,
                            bracket_label: e.target.value,
                          })
                        }
                        className="bg-background"
                      />
                    </div>
                  )}
                  <Button
                    onClick={addMatch}
                    disabled={
                      saving ||
                      !matchForm.team_a_id ||
                      !matchForm.team_b_id ||
                      matchForm.team_a_id === matchForm.team_b_id
                    }
                    className="w-full bg-primary"
                  >
                    {saving && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {tc("save")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// --- Match Card Component ---
function MatchCard({
  match,
  teamName,
  isTeamPropeleri,
  games,
  groups,
  tt,
  onUpdateScore,
  onMarkCompleted,
  onDelete,
  onLinkGame,
}: {
  match: TournamentMatch;
  teamName: (id: string) => string;
  isTeamPropeleri: (id: string) => boolean;
  games: Game[];
  groups: TournamentGroup[];
  tt: ReturnType<typeof useTranslations>;
  onUpdateScore: (id: string, a: number, b: number) => void;
  onMarkCompleted: (id: string) => void;
  onDelete: (id: string) => void;
  onLinkGame: (matchId: string, gameId: string) => void;
}) {
  const [scoreA, setScoreA] = useState(match.score_a);
  const [scoreB, setScoreB] = useState(match.score_b);

  const hasPropeleri =
    isTeamPropeleri(match.team_a_id) || isTeamPropeleri(match.team_b_id);
  const groupName = match.group_id
    ? groups.find((g) => g.id === match.group_id)?.name
    : null;

  return (
    <Card className="border-border/40">
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {match.bracket_label && (
              <Badge className="bg-purple-500/20 text-purple-400 text-xs shrink-0">
                {match.bracket_label}
              </Badge>
            )}
            {groupName && (
              <Badge className="bg-blue-500/20 text-blue-400 text-xs shrink-0">
                {groupName}
              </Badge>
            )}
            <span className="text-sm font-medium truncate">
              {teamName(match.team_a_id)}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <Input
                type="number"
                min={0}
                value={scoreA}
                onChange={(e) => setScoreA(parseInt(e.target.value) || 0)}
                className="w-12 h-7 text-center text-sm bg-background px-1"
                disabled={match.is_completed}
              />
              <span className="text-muted-foreground">:</span>
              <Input
                type="number"
                min={0}
                value={scoreB}
                onChange={(e) => setScoreB(parseInt(e.target.value) || 0)}
                className="w-12 h-7 text-center text-sm bg-background px-1"
                disabled={match.is_completed}
              />
            </div>
            <span className="text-sm font-medium truncate">
              {teamName(match.team_b_id)}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {match.is_completed ? (
              <Badge className="bg-green-600/20 text-green-400 text-xs">
                {tt("completed")}
              </Badge>
            ) : (
              <>
                {(scoreA !== match.score_a || scoreB !== match.score_b) && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => onUpdateScore(match.id, scoreA, scoreB)}
                  >
                    {tt("score")}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-green-500/30 text-green-400"
                  onClick={() => {
                    if (scoreA !== match.score_a || scoreB !== match.score_b) {
                      onUpdateScore(match.id, scoreA, scoreB);
                    }
                    onMarkCompleted(match.id);
                  }}
                >
                  <Check className="h-3 w-3" />
                </Button>
              </>
            )}

            {hasPropeleri && (
              <Select
                value={match.game_id ?? "__none__"}
                onValueChange={(v) => onLinkGame(match.id, v)}
              >
                <SelectTrigger className="h-7 w-24 text-xs bg-background">
                  <SelectValue placeholder={tt("linkGame")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {games.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      vs {g.opponent}{" "}
                      {new Date(g.game_date).toLocaleDateString("sr-Latn")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button
              size="icon"
              variant="ghost"
              className="text-red-400 hover:text-red-300 h-7 w-7"
              onClick={() => onDelete(match.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        {match.match_date && (
          <p className="text-xs text-muted-foreground mt-1">
            {new Date(match.match_date).toLocaleString("sr-Latn", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
