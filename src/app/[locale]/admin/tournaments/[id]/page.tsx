"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Image from "next/image";
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
  Pencil,
  ArrowUp,
  ArrowDown,
  Upload,
} from "lucide-react";
import imageCompression from "browser-image-compression";
import type {
  Tournament,
  Team,
  TournamentTeam,
  TournamentGroup,
  TournamentGroupTeam,
  TournamentMatch,
  TournamentMatchStage,
  Opponent,
} from "@/types/database";

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

type CountryOption = {
  code: string;
  label: string;
  aliases?: string[];
};

const DEFAULT_COUNTRY_CODE = "RS";

const COUNTRY_OPTIONS: CountryOption[] = [
  { code: "RS", label: "Serbia", aliases: ["Srbija", "Сербия"] },
  { code: "RU", label: "Russia", aliases: ["Россия"] },
  { code: "US", label: "United States", aliases: ["USA", "США"] },
  { code: "CA", label: "Canada" },
  { code: "CZ", label: "Czechia", aliases: ["Czech Republic", "Чехия"] },
  { code: "SK", label: "Slovakia", aliases: ["Словакия"] },
  { code: "SE", label: "Sweden", aliases: ["Швеция"] },
  { code: "FI", label: "Finland", aliases: ["Финляндия"] },
  { code: "NO", label: "Norway", aliases: ["Норвегия"] },
  { code: "DK", label: "Denmark", aliases: ["Дания"] },
  { code: "DE", label: "Germany", aliases: ["Deutschland", "Германия"] },
  { code: "AT", label: "Austria", aliases: ["Австрия"] },
  { code: "CH", label: "Switzerland", aliases: ["Швейцария"] },
  { code: "SI", label: "Slovenia", aliases: ["Словения"] },
  { code: "HR", label: "Croatia", aliases: ["Хорватия"] },
  { code: "BA", label: "Bosnia and Herzegovina", aliases: ["Bosna i Hercegovina", "Босния"] },
  { code: "ME", label: "Montenegro", aliases: ["Црна Гора", "Черногория"] },
  { code: "MK", label: "North Macedonia", aliases: ["Macedonia", "Македония"] },
  { code: "RO", label: "Romania", aliases: ["Румыния"] },
  { code: "HU", label: "Hungary", aliases: ["Венгрия"] },
  { code: "PL", label: "Poland", aliases: ["Польша"] },
  { code: "IT", label: "Italy", aliases: ["Италия"] },
  { code: "FR", label: "France", aliases: ["Франция"] },
  { code: "GB", label: "United Kingdom", aliases: ["UK", "Великобритания"] },
  { code: "UA", label: "Ukraine", aliases: ["Украина"] },
  { code: "LV", label: "Latvia", aliases: ["Латвия"] },
  { code: "LT", label: "Lithuania", aliases: ["Литва"] },
  { code: "EE", label: "Estonia", aliases: ["Эстония"] },
];

function resolveCountryCode(value: string | null | undefined): string {
  const cleaned = value?.trim();
  if (!cleaned) return "";

  const byCode = COUNTRY_OPTIONS.find((option) => option.code === cleaned.toUpperCase());
  if (byCode) return byCode.code;

  const normalized = normalizeName(cleaned);
  const byName = COUNTRY_OPTIONS.find((option) => {
    if (normalizeName(option.label) === normalized) return true;
    return option.aliases?.some((alias) => normalizeName(alias) === normalized) ?? false;
  });

  return byName?.code ?? "";
}

function countryDisplayName(value: string | null | undefined): string {
  const cleaned = value?.trim();
  if (!cleaned) return "";

  const code = resolveCountryCode(cleaned);
  if (!code) return cleaned;

  return COUNTRY_OPTIONS.find((option) => option.code === code)?.label ?? cleaned;
}

function countryFlagEmoji(value: string | null | undefined): string {
  const code = resolveCountryCode(value);
  if (code.length !== 2) return "🏳️";

  return String.fromCodePoint(...code.split("").map((char) => 127397 + char.charCodeAt(0)));
}

type TeamForm = {
  name: string;
  city: string;
  country: string;
  logo_url: string;
  is_propeleri: boolean;
  opponent_id: string;
};

type MatchForm = {
  team_a_id: string;
  team_b_id: string;
  stage: TournamentMatchStage;
  group_id: string;
  match_date: string;
  bracket_label: string;
};

export default function AdminTournamentDetailPage() {
  const params = useParams();
  const tournamentId = params.id as string;
  const tt = useTranslations("tournament");
  const tc = useTranslations("common");

  const supabase = useMemo(() => createClient(), []);

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [opponents, setOpponents] = useState<Opponent[]>([]);
  const [tournamentTeamJunctions, setTournamentTeamJunctions] = useState<TournamentTeam[]>([]);
  const [groups, setGroups] = useState<TournamentGroup[]>([]);
  const [groupTeams, setGroupTeams] = useState<TournamentGroupTeam[]>([]);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState("");

  // Team add dialog
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [teamMode, setTeamMode] = useState<"new" | "existing">("existing");
  const [teamForm, setTeamForm] = useState<TeamForm>({
    name: "",
    city: "",
    country: DEFAULT_COUNTRY_CODE,
    logo_url: "",
    is_propeleri: false,
    opponent_id: "",
  });
  const [selectedExistingTeamId, setSelectedExistingTeamId] = useState("");

  // Team edit dialog
  const [teamEditDialogOpen, setTeamEditDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [teamEditForm, setTeamEditForm] = useState<TeamForm>({
    name: "",
    city: "",
    country: "",
    logo_url: "",
    is_propeleri: false,
    opponent_id: "",
  });

  // Group dialogs
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: "" });
  const [groupEditDialogOpen, setGroupEditDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<TournamentGroup | null>(null);
  const [groupEditName, setGroupEditName] = useState("");

  // Match dialogs
  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [matchForm, setMatchForm] = useState<MatchForm>({
    team_a_id: "",
    team_b_id: "",
    stage: "group",
    group_id: "",
    match_date: "",
    bracket_label: "",
  });

  const [matchEditDialogOpen, setMatchEditDialogOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<TournamentMatch | null>(null);
  const [matchEditForm, setMatchEditForm] = useState<MatchForm>({
    team_a_id: "",
    team_b_id: "",
    stage: "group",
    group_id: "",
    match_date: "",
    bracket_label: "",
  });

  const loadAll = useCallback(async () => {
    const [
      tournamentRes,
      junctionsRes,
      allTeamsRes,
      groupsRes,
      groupTeamsRes,
      matchesRes,
      opponentsRes,
    ] = await Promise.all([
      supabase.from("tournaments").select("*").eq("id", tournamentId).single(),
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
      supabase.from("opponents").select("*").eq("is_active", true).order("name"),
    ]);

    setTournament((tournamentRes.data ?? null) as Tournament | null);

    const globalTeams = (allTeamsRes.data ?? []) as Team[];
    let junctions = (junctionsRes.data ?? []) as TournamentTeam[];

    const propeleriTeam = globalTeams.find((team) => team.is_propeleri);
    const hasPropeleriInTournament =
      !!propeleriTeam && junctions.some((item) => item.team_id === propeleriTeam.id);

    if (propeleriTeam && !hasPropeleriInTournament) {
      const nextSortOrder =
        junctions.length > 0
          ? Math.max(...junctions.map((item) => item.sort_order)) + 1
          : 0;

      const { error: linkError } = await supabase.from("tournament_teams").insert({
        tournament_id: tournamentId,
        team_id: propeleriTeam.id,
        sort_order: nextSortOrder,
      });

      if (linkError && !linkError.message.toLowerCase().includes("duplicate")) {
        setError(linkError.message);
      } else {
        const { data: refreshedJunctions } = await supabase
          .from("tournament_teams")
          .select("*")
          .eq("tournament_id", tournamentId)
          .order("sort_order");
        junctions = (refreshedJunctions ?? []) as TournamentTeam[];
      }
    }

    setTournamentTeamJunctions(junctions);
    setAllTeams(globalTeams);

    const teamIds = new Set(junctions.map((j) => j.team_id));
    setTeams(globalTeams.filter((team) => teamIds.has(team.id)));

    const groupsData = (groupsRes.data ?? []) as TournamentGroup[];
    setGroups(groupsData);

    const groupIds = new Set(groupsData.map((group) => group.id));
    setGroupTeams(
      ((groupTeamsRes.data ?? []) as TournamentGroupTeam[]).filter((gt) =>
        groupIds.has(gt.group_id)
      )
    );

    setMatches((matchesRes.data ?? []) as TournamentMatch[]);
    setOpponents((opponentsRes.data ?? []) as Opponent[]);
    setLoading(false);
  }, [supabase, tournamentId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAll();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAll]);

  async function ensureOpponent(name: string): Promise<string | null> {
    const cleaned = name.trim();
    if (!cleaned) return null;

    const normalized = normalizeName(cleaned);
    const existing = opponents.find((opponent) => normalizeName(opponent.name) === normalized);
    if (existing) return existing.id;

    const { data: existingRows } = await supabase
      .from("opponents")
      .select("*")
      .eq("normalized_name", normalized)
      .limit(1);

    if (existingRows?.[0]) {
      const row = existingRows[0] as Opponent;
      setOpponents((prev) =>
        prev.some((opponent) => opponent.id === row.id) ? prev : [...prev, row]
      );
      return row.id;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("opponents")
      .insert({ name: cleaned })
      .select("*")
      .single();

    if (insertError) {
      setError(insertError.message);
      return null;
    }

    const created = inserted as Opponent;
    setOpponents((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    return created.id;
  }

  async function uploadTeamLogo(file: File, formTarget: "new" | "edit") {
    setUploadingLogo(true);
    setError("");

    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.25,
        maxWidthOrHeight: 512,
        useWebWorker: true,
      });

      const ext = compressed.type === "image/png" ? "png" : "jpg";
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const ownerId = user?.id ?? "admin";
      const filePath = `${ownerId}/teams/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, compressed, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      if (formTarget === "new") {
        setTeamForm((prev) => ({ ...prev, logo_url: publicUrl }));
      } else {
        setTeamEditForm((prev) => ({ ...prev, logo_url: publicUrl }));
      }
    } catch (uploadError: unknown) {
      setError(uploadError instanceof Error ? uploadError.message : "Failed to upload team logo");
    } finally {
      setUploadingLogo(false);
    }
  }

  // --- TEAMS ---
  async function addTeam() {
    setSaving(true);
    setError("");

    let teamId: string;

    if (teamMode === "existing" && selectedExistingTeamId) {
      teamId = selectedExistingTeamId;
    } else {
      let opponentId: string | null = null;
      if (!teamForm.is_propeleri) {
        opponentId =
          teamForm.opponent_id || (await ensureOpponent(teamForm.name)) || null;
      }

      const { data, error: createError } = await supabase
        .from("teams")
        .insert({
          name: teamForm.name,
          city: teamForm.city || null,
          country: teamForm.country || null,
          logo_url: teamForm.logo_url || null,
          is_propeleri: teamForm.is_propeleri,
          opponent_id: teamForm.is_propeleri ? null : opponentId,
        })
        .select("id")
        .single();

      if (createError || !data) {
        setError(createError?.message ?? "Failed to create team");
        setSaving(false);
        return;
      }
      teamId = data.id;
    }

    const { error: linkError } = await supabase.from("tournament_teams").insert({
      tournament_id: tournamentId,
      team_id: teamId,
      sort_order: teams.length,
    });

    if (linkError) {
      setError(linkError.message);
      setSaving(false);
      return;
    }

    setTeamDialogOpen(false);
    setTeamForm({
      name: "",
      city: "",
      country: DEFAULT_COUNTRY_CODE,
      logo_url: "",
      is_propeleri: false,
      opponent_id: "",
    });
    setSelectedExistingTeamId("");
    setSaving(false);
    await loadAll();
  }

  function openEditTeamDialog(team: Team) {
    setEditingTeam(team);
    setTeamEditForm({
      name: team.name,
      city: team.city ?? "",
      country: resolveCountryCode(team.country) || team.country || "",
      logo_url: team.logo_url ?? "",
      is_propeleri: team.is_propeleri,
      opponent_id: team.opponent_id ?? "",
    });
    setTeamEditDialogOpen(true);
  }

  async function saveTeamEdit() {
    if (!editingTeam) return;

    setSaving(true);
    setError("");

    let opponentId: string | null = teamEditForm.opponent_id || null;
    if (!teamEditForm.is_propeleri && !opponentId) {
      opponentId = (await ensureOpponent(teamEditForm.name)) || null;
    }

    const { error: updateError } = await supabase
      .from("teams")
      .update({
        name: teamEditForm.name,
        city: teamEditForm.city || null,
        country: teamEditForm.country || null,
        logo_url: teamEditForm.logo_url || null,
        is_propeleri: teamEditForm.is_propeleri,
        opponent_id: teamEditForm.is_propeleri ? null : opponentId,
      })
      .eq("id", editingTeam.id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setTeamEditDialogOpen(false);
    setEditingTeam(null);
    setSaving(false);
    await loadAll();
  }

  async function removeTeamFromTournament(teamId: string) {
    const junction = tournamentTeamJunctions.find((item) => item.team_id === teamId);
    if (!junction) return;

    await supabase.from("tournament_teams").delete().eq("id", junction.id);
    await loadAll();
  }

  // --- GROUPS ---
  async function addGroup() {
    setSaving(true);
    setError("");

    const { error: insertError } = await supabase.from("tournament_groups").insert({
      tournament_id: tournamentId,
      name: groupForm.name,
      sort_order: groups.length,
    });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setGroupDialogOpen(false);
    setGroupForm({ name: "" });
    setSaving(false);
    await loadAll();
  }

  function openEditGroupDialog(group: TournamentGroup) {
    setEditingGroup(group);
    setGroupEditName(group.name);
    setGroupEditDialogOpen(true);
  }

  async function saveGroupEdit() {
    if (!editingGroup) return;

    setSaving(true);
    const { error: updateError } = await supabase
      .from("tournament_groups")
      .update({ name: groupEditName })
      .eq("id", editingGroup.id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setGroupEditDialogOpen(false);
    setEditingGroup(null);
    setSaving(false);
    await loadAll();
  }

  async function moveGroup(groupId: string, direction: "up" | "down") {
    const ordered = [...groups].sort((a, b) => a.sort_order - b.sort_order);
    const currentIndex = ordered.findIndex((group) => group.id === groupId);
    if (currentIndex === -1) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= ordered.length) return;

    const current = ordered[currentIndex];
    const target = ordered[targetIndex];

    await Promise.all([
      supabase
        .from("tournament_groups")
        .update({ sort_order: target.sort_order })
        .eq("id", current.id),
      supabase
        .from("tournament_groups")
        .update({ sort_order: current.sort_order })
        .eq("id", target.id),
    ]);

    await loadAll();
  }

  async function deleteGroup(id: string) {
    await supabase.from("tournament_groups").delete().eq("id", id);
    await loadAll();
  }

  async function toggleTeamInGroup(groupId: string, teamId: string) {
    const existing = groupTeams.find(
      (groupTeam) => groupTeam.group_id === groupId && groupTeam.team_id === teamId
    );

    if (existing) {
      await supabase.from("tournament_group_teams").delete().eq("id", existing.id);
    } else {
      await supabase.from("tournament_group_teams").insert({ group_id: groupId, team_id: teamId });
    }

    await loadAll();
  }

  // --- MATCHES ---
  function findGroupForMatch(teamAId: string, teamBId: string): string | null {
    for (const group of groups) {
      const groupMemberIds = groupTeams
        .filter((item) => item.group_id === group.id)
        .map((item) => item.team_id);

      if (groupMemberIds.includes(teamAId) && groupMemberIds.includes(teamBId)) {
        return group.id;
      }
    }
    return null;
  }

  async function addMatch() {
    setSaving(true);
    setError("");

    const resolvedGroupId =
      matchForm.stage === "group"
        ? matchForm.group_id || findGroupForMatch(matchForm.team_a_id, matchForm.team_b_id)
        : null;

    const { error: insertError } = await supabase.from("tournament_matches").insert({
      tournament_id: tournamentId,
      team_a_id: matchForm.team_a_id,
      team_b_id: matchForm.team_b_id,
      stage: matchForm.stage,
      group_id: resolvedGroupId,
      match_date: matchForm.match_date || null,
      bracket_label: matchForm.bracket_label || null,
    });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setMatchDialogOpen(false);
    setMatchForm({
      team_a_id: "",
      team_b_id: "",
      stage: "group",
      group_id: "",
      match_date: "",
      bracket_label: "",
    });
    setSaving(false);
    await loadAll();
  }

  function openEditMatchDialog(match: TournamentMatch) {
    setEditingMatch(match);
    setMatchEditForm({
      team_a_id: match.team_a_id,
      team_b_id: match.team_b_id,
      stage: match.stage,
      group_id: match.group_id ?? "",
      match_date: match.match_date ? match.match_date.slice(0, 16) : "",
      bracket_label: match.bracket_label ?? "",
    });
    setMatchEditDialogOpen(true);
  }

  async function saveMatchEdit() {
    if (!editingMatch) return;

    setSaving(true);
    setError("");

    const resolvedGroupId =
      matchEditForm.stage === "group"
        ? matchEditForm.group_id || findGroupForMatch(matchEditForm.team_a_id, matchEditForm.team_b_id)
        : null;

    const { error: updateError } = await supabase
      .from("tournament_matches")
      .update({
        team_a_id: matchEditForm.team_a_id,
        team_b_id: matchEditForm.team_b_id,
        stage: matchEditForm.stage,
        group_id: resolvedGroupId,
        match_date: matchEditForm.match_date || null,
        bracket_label: matchEditForm.bracket_label || null,
      })
      .eq("id", editingMatch.id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setMatchEditDialogOpen(false);
    setEditingMatch(null);
    setSaving(false);
    await loadAll();
  }

  async function updateMatchScore(matchId: string, scoreA: number, scoreB: number) {
    await supabase
      .from("tournament_matches")
      .update({ score_a: scoreA, score_b: scoreB })
      .eq("id", matchId);
    await loadAll();
  }

  async function toggleMatchCompleted(matchId: string, current: boolean) {
    await supabase
      .from("tournament_matches")
      .update({ is_completed: !current })
      .eq("id", matchId);
    await loadAll();
  }

  async function deleteMatch(id: string) {
    await supabase.from("tournament_matches").delete().eq("id", id);
    await loadAll();
  }

  function teamName(id: string) {
    return teams.find((team) => team.id === id)?.name ?? "?";
  }

  function isTeamPropeleri(id: string) {
    return teams.find((team) => team.id === id)?.is_propeleri ?? false;
  }

  const countryOptions = useMemo(() => {
    const map = new Map<string, string>();

    for (const option of COUNTRY_OPTIONS) {
      map.set(option.code, option.label);
    }

    for (const team of allTeams) {
      const raw = team.country?.trim();
      if (!raw) continue;

      const code = resolveCountryCode(raw);
      if (!code) map.set(raw, raw);
    }

    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [allTeams]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!tournament) {
    return <div className="p-6 text-center text-muted-foreground">Tournament not found</div>;
  }

  const teamIdsInTournament = new Set(teams.map((team) => team.id));
  const availableTeams = allTeams.filter((team) => !teamIdsInTournament.has(team.id));

  const groupMatches = matches.filter((match) => match.stage === "group");
  const playoffMatches = matches.filter((match) => match.stage === "playoff");

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

      <div className="p-6 space-y-3">
        {error && (
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
            {error}
          </p>
        )}

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
              <p className="text-muted-foreground text-center py-10">{tt("noTeams")}</p>
            ) : (
              <div className="space-y-2">
                {teams.map((team) => (
                  <Card key={team.id} className="border-border/40">
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 shrink-0 rounded-full border border-border/50 overflow-hidden bg-muted flex items-center justify-center text-xs">
                          {team.logo_url ? (
                            <Image
                              src={team.logo_url}
                              alt={team.name}
                              width={24}
                              height={24}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span>{countryFlagEmoji(team.country)}</span>
                          )}
                        </div>
                        <span className="font-medium text-sm">{team.name}</span>
                        {team.is_propeleri && (
                          <Badge className="bg-primary/20 text-primary text-xs">
                            {tt("propeleri")}
                          </Badge>
                        )}
                        {(team.city || team.country) && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {[team.city, countryDisplayName(team.country)].filter(Boolean).join(", ")}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => openEditTeamDialog(team)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-red-400 hover:text-red-300 h-8 w-8"
                          onClick={() => removeTeamFromTournament(team.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
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
                        onValueChange={(value) =>
                          setSelectedExistingTeamId(value === "__none__" ? "" : value)
                        }
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">—</SelectItem>
                          {availableTeams.map((team) => (
                            <SelectItem key={team.id} value={team.id}>
                              {team.name}
                              {team.city && ` (${team.city})`}
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
                            {tt("city")}
                          </Label>
                          <Input
                            value={teamForm.city}
                            onChange={(e) =>
                              setTeamForm({ ...teamForm, city: e.target.value })
                            }
                            className="bg-background"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            {tt("country")}
                          </Label>
                          <Select
                            value={teamForm.country || "__none__"}
                            onValueChange={(value) =>
                              setTeamForm({
                                ...teamForm,
                                country: value === "__none__" ? "" : value,
                              })
                            }
                          >
                            <SelectTrigger className="bg-background">
                              <SelectValue placeholder={tt("country")} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">—</SelectItem>
                              {countryOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {countryFlagEmoji(option.value)} {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>{tt("teamLogo")}</Label>
                        <Input
                          value={teamForm.logo_url}
                          onChange={(e) =>
                            setTeamForm({ ...teamForm, logo_url: e.target.value })
                          }
                          className="bg-background"
                          placeholder="https://..."
                        />
                        <label className="cursor-pointer inline-block">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={uploadingLogo || saving}
                            onChange={async (e) => {
                              const input = e.currentTarget;
                              const file = input.files?.[0];
                              if (file) {
                                await uploadTeamLogo(file, "new");
                              }
                              input.value = "";
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            asChild
                            disabled={uploadingLogo || saving}
                          >
                            <span>
                              {uploadingLogo ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Upload className="mr-2 h-4 w-4" />
                              )}
                              {tt("uploadLogo")}
                            </span>
                          </Button>
                        </label>
                      </div>

                    </>
                  )}

                  <Button
                    onClick={addTeam}
                    disabled={
                      saving ||
                      (teamMode === "new" ? !teamForm.name : !selectedExistingTeamId)
                    }
                    className="w-full bg-primary"
                  >
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {tc("save")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={teamEditDialogOpen} onOpenChange={setTeamEditDialogOpen}>
              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle>{tt("editTeam")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{tt("teamName")}</Label>
                    <Input
                      value={teamEditForm.name}
                      onChange={(e) =>
                        setTeamEditForm({ ...teamEditForm, name: e.target.value })
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{tt("city")}</Label>
                      <Input
                        value={teamEditForm.city}
                        onChange={(e) =>
                          setTeamEditForm({ ...teamEditForm, city: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{tt("country")}</Label>
                      <Select
                        value={teamEditForm.country || "__none__"}
                        onValueChange={(value) =>
                          setTeamEditForm({
                            ...teamEditForm,
                            country: value === "__none__" ? "" : value,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={tt("country")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">—</SelectItem>
                          {countryOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {countryFlagEmoji(option.value)} {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{tt("teamLogo")}</Label>
                    <Input
                      value={teamEditForm.logo_url}
                      onChange={(e) =>
                        setTeamEditForm({ ...teamEditForm, logo_url: e.target.value })
                      }
                      placeholder="https://..."
                    />
                    <label className="cursor-pointer inline-block">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploadingLogo || saving}
                        onChange={async (e) => {
                          const input = e.currentTarget;
                          const file = input.files?.[0];
                          if (file) {
                            await uploadTeamLogo(file, "edit");
                          }
                          input.value = "";
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        asChild
                        disabled={uploadingLogo || saving}
                      >
                        <span>
                          {uploadingLogo ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="mr-2 h-4 w-4" />
                          )}
                          {tt("uploadLogo")}
                        </span>
                      </Button>
                    </label>
                  </div>

                  <Button
                    onClick={saveTeamEdit}
                    disabled={saving || !teamEditForm.name.trim()}
                    className="w-full bg-primary"
                  >
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {tc("save")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="groups">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{tt("groups")}</h2>
              <Button size="sm" onClick={() => setGroupDialogOpen(true)} className="bg-primary">
                <Plus className="h-4 w-4 mr-1" />
                {tt("addGroup")}
              </Button>
            </div>

            {groups.length === 0 ? (
              <p className="text-muted-foreground text-center py-10">{tt("noGroups")}</p>
            ) : (
              <div className="space-y-4">
                {[...groups]
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((group, index) => {
                    const memberIds = groupTeams
                      .filter((item) => item.group_id === group.id)
                      .map((item) => item.team_id);

                    return (
                      <Card key={group.id} className="border-border/40">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-medium">{group.name}</h3>
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => moveGroup(group.id, "up")}
                                disabled={index === 0}
                              >
                                <ArrowUp className="h-3 w-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => moveGroup(group.id, "down")}
                                disabled={index === groups.length - 1}
                              >
                                <ArrowDown className="h-3 w-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => openEditGroupDialog(group)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-red-400 hover:text-red-300 h-8 w-8"
                                onClick={() => deleteGroup(group.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {teams.map((team) => {
                              const isMember = memberIds.includes(team.id);
                              return (
                                <button
                                  key={team.id}
                                  onClick={() => toggleTeamInGroup(group.id, team.id)}
                                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                                    isMember
                                      ? "bg-primary/20 text-primary border-primary/40"
                                      : "bg-muted/30 text-muted-foreground border-border/40 hover:border-primary/40"
                                  }`}
                                >
                                  {team.name}
                                  {isMember && <Check className="inline h-3 w-3 ml-1" />}
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
                      onChange={(e) => setGroupForm({ name: e.target.value })}
                      className="bg-background"
                    />
                  </div>
                  <Button
                    onClick={addGroup}
                    disabled={saving || !groupForm.name.trim()}
                    className="w-full bg-primary"
                  >
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {tc("save")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={groupEditDialogOpen} onOpenChange={setGroupEditDialogOpen}>
              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle>{tt("editGroup")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{tt("groupName")}</Label>
                    <Input
                      value={groupEditName}
                      onChange={(e) => setGroupEditName(e.target.value)}
                      className="bg-background"
                    />
                  </div>
                  <Button
                    onClick={saveGroupEdit}
                    disabled={saving || !groupEditName.trim()}
                    className="w-full bg-primary"
                  >
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {tc("save")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

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
              <p className="text-muted-foreground text-center py-10">{tt("noMatches")}</p>
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
                          key={`${match.id}-${match.score_a}-${match.score_b}-${match.is_completed ? 1 : 0}`}
                          match={match}
                          teamName={teamName}
                          isTeamPropeleri={isTeamPropeleri}
                          groups={groups}
                          tt={tt}
                          onUpdateScore={updateMatchScore}
                          onToggleCompleted={toggleMatchCompleted}
                          onDelete={deleteMatch}
                          onEdit={openEditMatchDialog}
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
                          key={`${match.id}-${match.score_a}-${match.score_b}-${match.is_completed ? 1 : 0}`}
                          match={match}
                          teamName={teamName}
                          isTeamPropeleri={isTeamPropeleri}
                          groups={groups}
                          tt={tt}
                          onUpdateScore={updateMatchScore}
                          onToggleCompleted={toggleMatchCompleted}
                          onDelete={deleteMatch}
                          onEdit={openEditMatchDialog}
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
                  <MatchFormFields
                    form={matchForm}
                    setForm={setMatchForm}
                    teams={teams}
                    groups={groups}
                    tt={tt}
                  />

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
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {tc("save")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={matchEditDialogOpen} onOpenChange={setMatchEditDialogOpen}>
              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle>{tt("editMatch")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <MatchFormFields
                    form={matchEditForm}
                    setForm={setMatchEditForm}
                    teams={teams}
                    groups={groups}
                    tt={tt}
                  />

                  <Button
                    onClick={saveMatchEdit}
                    disabled={
                      saving ||
                      !matchEditForm.team_a_id ||
                      !matchEditForm.team_b_id ||
                      matchEditForm.team_a_id === matchEditForm.team_b_id
                    }
                    className="w-full bg-primary"
                  >
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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

function MatchFormFields({
  form,
  setForm,
  teams,
  groups,
  tt,
}: {
  form: MatchForm;
  setForm: React.Dispatch<React.SetStateAction<MatchForm>>;
  teams: Team[];
  groups: TournamentGroup[];
  tt: ReturnType<typeof useTranslations>;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label>{tt("stage")}</Label>
        <Select
          value={form.stage}
          onValueChange={(value) =>
            setForm((prev) => ({
              ...prev,
              stage: value as TournamentMatchStage,
              group_id: value === "group" ? prev.group_id : "",
            }))
          }
        >
          <SelectTrigger className="bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="group">{tt("groupStage")}</SelectItem>
            <SelectItem value="playoff">{tt("playoffStage")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {form.stage === "group" && (
        <div className="space-y-2">
          <Label>{tt("group")}</Label>
          <Select
            value={form.group_id || "__none__"}
            onValueChange={(value) =>
              setForm((prev) => ({
                ...prev,
                group_id: value === "__none__" ? "" : value,
              }))
            }
          >
            <SelectTrigger className="bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">—</SelectItem>
              {groups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{tt("selectTeamA")}</Label>
          <Select
            value={form.team_a_id || "__none__"}
            onValueChange={(value) =>
              setForm((prev) => ({
                ...prev,
                team_a_id: value === "__none__" ? "" : value,
              }))
            }
          >
            <SelectTrigger className="bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">—</SelectItem>
              {teams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{tt("selectTeamB")}</Label>
          <Select
            value={form.team_b_id || "__none__"}
            onValueChange={(value) =>
              setForm((prev) => ({
                ...prev,
                team_b_id: value === "__none__" ? "" : value,
              }))
            }
          >
            <SelectTrigger className="bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">—</SelectItem>
              {teams
                .filter((team) => team.id !== form.team_a_id)
                .map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
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
          value={form.match_date}
          onChange={(e) => setForm((prev) => ({ ...prev, match_date: e.target.value }))}
          className="bg-background"
        />
      </div>

      {form.stage === "playoff" && (
        <div className="space-y-2">
          <Label>{tt("label")}</Label>
          <Input
            value={form.bracket_label}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, bracket_label: e.target.value }))
            }
            className="bg-background"
          />
        </div>
      )}
    </>
  );
}

function MatchCard({
  match,
  teamName,
  isTeamPropeleri,
  groups,
  tt,
  onUpdateScore,
  onToggleCompleted,
  onDelete,
  onEdit,
}: {
  match: TournamentMatch;
  teamName: (id: string) => string;
  isTeamPropeleri: (id: string) => boolean;
  groups: TournamentGroup[];
  tt: ReturnType<typeof useTranslations>;
  onUpdateScore: (id: string, scoreA: number, scoreB: number) => void;
  onToggleCompleted: (id: string, current: boolean) => void;
  onDelete: (id: string) => void;
  onEdit: (match: TournamentMatch) => void;
}) {
  const [scoreA, setScoreA] = useState(match.score_a);
  const [scoreB, setScoreB] = useState(match.score_b);

  const hasPropeleri =
    isTeamPropeleri(match.team_a_id) || isTeamPropeleri(match.team_b_id);
  const groupName = match.group_id
    ? groups.find((group) => group.id === match.group_id)?.name
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
            {hasPropeleri && (
              <Badge className="bg-primary/20 text-primary text-xs shrink-0">
                {tt("propeleri")}
              </Badge>
            )}
            <span className="text-sm font-medium truncate">{teamName(match.team_a_id)}</span>
            <div className="flex items-center gap-1 shrink-0">
              <Input
                type="number"
                min={0}
                value={scoreA}
                onChange={(e) => setScoreA(parseInt(e.target.value, 10) || 0)}
                className="w-12 h-7 text-center text-sm bg-background px-1"
              />
              <span className="text-muted-foreground">:</span>
              <Input
                type="number"
                min={0}
                value={scoreB}
                onChange={(e) => setScoreB(parseInt(e.target.value, 10) || 0)}
                className="w-12 h-7 text-center text-sm bg-background px-1"
              />
            </div>
            <span className="text-sm font-medium truncate">{teamName(match.team_b_id)}</span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
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
              className={`h-7 text-xs ${
                match.is_completed
                  ? "border-yellow-500/30 text-yellow-400"
                  : "border-green-500/30 text-green-400"
              }`}
              onClick={() => onToggleCompleted(match.id, match.is_completed)}
            >
              {match.is_completed ? tt("reopen") : tt("complete")}
            </Button>

            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => onEdit(match)}
            >
              <Pencil className="h-3 w-3" />
            </Button>

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
