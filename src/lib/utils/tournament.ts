import type {
  Team,
  TournamentMatch,
  GroupStandingRow,
} from "@/types/database";

/**
 * Compute group standings from completed matches.
 * Points: 3 for win, 1 for draw, 0 for loss.
 * Sort: points → goal diff → goals for.
 */
export function computeGroupStandings(
  teams: Team[],
  matches: TournamentMatch[]
): GroupStandingRow[] {
  const map = new Map<string, GroupStandingRow>();

  for (const team of teams) {
    map.set(team.id, {
      team,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goals_for: 0,
      goals_against: 0,
      goal_diff: 0,
      points: 0,
    });
  }

  for (const m of matches) {
    if (!m.is_completed) continue;

    const rowA = map.get(m.team_a_id);
    const rowB = map.get(m.team_b_id);
    if (!rowA || !rowB) continue;

    rowA.played++;
    rowB.played++;
    rowA.goals_for += m.score_a;
    rowA.goals_against += m.score_b;
    rowB.goals_for += m.score_b;
    rowB.goals_against += m.score_a;

    if (m.score_a > m.score_b) {
      rowA.wins++;
      rowB.losses++;
    } else if (m.score_a < m.score_b) {
      rowB.wins++;
      rowA.losses++;
    } else {
      rowA.draws++;
      rowB.draws++;
    }
  }

  for (const row of map.values()) {
    row.goal_diff = row.goals_for - row.goals_against;
    row.points = row.wins * 3 + row.draws;
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goal_diff !== a.goal_diff) return b.goal_diff - a.goal_diff;
    return b.goals_for - a.goals_for;
  });
}
