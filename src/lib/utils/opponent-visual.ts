import type { Opponent, Team } from "@/types/database";

type OpponentVisual = {
  logoUrl: string | null;
  country: string | null;
};

type OpponentVisualLookup = {
  byOpponentId: Map<string, OpponentVisual>;
  byNormalizedName: Map<string, OpponentVisual>;
};

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function buildOpponentVisualLookup(
  teams: Team[],
  opponents: Opponent[]
): OpponentVisualLookup {
  const byOpponentId = new Map<string, OpponentVisual>();
  const byNormalizedName = new Map<string, OpponentVisual>();

  for (const team of teams) {
    if (team.is_propeleri) continue;

    const visual: OpponentVisual = {
      logoUrl: team.logo_url ?? null,
      country: team.country ?? null,
    };

    if (team.opponent_id) byOpponentId.set(team.opponent_id, visual);
    byNormalizedName.set(normalizeName(team.name), visual);
  }

  for (const opponent of opponents) {
    const existingById = byOpponentId.get(opponent.id);

    if (!existingById) {
      byOpponentId.set(opponent.id, {
        logoUrl: null,
        country: opponent.country ?? null,
      });
    } else if (!existingById.country && opponent.country) {
      byOpponentId.set(opponent.id, {
        ...existingById,
        country: opponent.country,
      });
    }

    const key = normalizeName(opponent.name);
    const existingByName = byNormalizedName.get(key);

    if (!existingByName) {
      byNormalizedName.set(key, { logoUrl: null, country: opponent.country ?? null });
    } else if (!existingByName.country && opponent.country) {
      byNormalizedName.set(key, {
        ...existingByName,
        country: opponent.country,
      });
    }
  }

  return { byOpponentId, byNormalizedName };
}

export function resolveOpponentVisual(
  gameLike: { opponent_id: string | null; opponent: string },
  lookup: OpponentVisualLookup
): OpponentVisual {
  if (gameLike.opponent_id) {
    const byId = lookup.byOpponentId.get(gameLike.opponent_id);
    if (byId) return byId;
  }

  const byName = lookup.byNormalizedName.get(normalizeName(gameLike.opponent));
  if (byName) return byName;

  return { logoUrl: null, country: null };
}
