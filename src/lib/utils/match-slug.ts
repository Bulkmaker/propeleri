import type { TournamentMatchStage } from "@/types/database";

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "c",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

function transliterateCyrillic(input: string): string {
  return input
    .split("")
    .map((char) => CYRILLIC_TO_LATIN[char] ?? char)
    .join("");
}

export function slugify(value: string): string {
  const normalized = transliterateCyrillic(
    value
      .trim()
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
  );

  return normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function formatMatchDateSlug(matchDate: string | null): string {
  if (!matchDate) return "no-date";
  const date = new Date(matchDate);
  if (Number.isNaN(date.getTime())) return "no-date";

  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildTournamentMatchSlug(params: {
  matchDate: string | null;
  opponentName: string;
  tournamentName: string;
  stage: TournamentMatchStage;
}): string {
  const datePart = formatMatchDateSlug(params.matchDate);
  const opponentPart = slugify(params.opponentName) || "opponent";
  const tournamentPart = slugify(params.tournamentName) || "tournament";
  const stagePart = params.stage === "group" ? "group-stage" : "playoff-stage";
  return `${datePart}-${opponentPart}-${tournamentPart}-${stagePart}`;
}

export function buildTournamentMatchUrlParam(params: {
  matchId: string;
  matchDate: string | null;
  opponentName: string;
  tournamentName: string;
  stage: TournamentMatchStage;
}): string {
  const slug = buildTournamentMatchSlug({
    matchDate: params.matchDate,
    opponentName: params.opponentName,
    tournamentName: params.tournamentName,
    stage: params.stage,
  });

  return `${params.matchId}--${slug}`;
}

export function parseTournamentMatchUrlParam(value: string): string {
  const [idPart] = value.split("--");
  return idPart;
}

