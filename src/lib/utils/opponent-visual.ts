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

    const key = normalizeName(team.name);
    const existingByName = byNormalizedName.get(key);
    const mergedByName: OpponentVisual = {
      logoUrl: existingByName?.logoUrl ?? team.logo_url ?? null,
      country: existingByName?.country ?? team.country ?? null,
    };

    byNormalizedName.set(key, mergedByName);

    if (team.opponent_id) {
      const existingById = byOpponentId.get(team.opponent_id);
      byOpponentId.set(team.opponent_id, {
        logoUrl: existingById?.logoUrl ?? team.logo_url ?? null,
        country: existingById?.country ?? team.country ?? null,
      });
    }
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
  const byName = lookup.byNormalizedName.get(normalizeName(gameLike.opponent));

  if (gameLike.opponent_id) {
    const byId = lookup.byOpponentId.get(gameLike.opponent_id);
    if (byId) {
      return {
        logoUrl: byId.logoUrl ?? byName?.logoUrl ?? null,
        country: byId.country ?? byName?.country ?? null,
      };
    }
  }

  if (byName) return byName;

  return { logoUrl: null, country: null };
}
