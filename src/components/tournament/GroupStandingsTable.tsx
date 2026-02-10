import type { GroupStandingRow } from "@/types/database";

interface Props {
  groupName: string;
  standings: GroupStandingRow[];
  labels: {
    played: string;
    won: string;
    drawn: string;
    lost: string;
    goalsFor: string;
    goalsAgainst: string;
    goalDiff: string;
    pts: string;
  };
}

export function GroupStandingsTable({ groupName, standings, labels }: Props) {
  return (
    <div className="rounded-lg border border-border/40 overflow-hidden">
      <div className="bg-card/50 px-4 py-2 border-b border-border/40">
        <h3 className="font-semibold text-sm">{groupName}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40 text-xs text-muted-foreground">
              <th className="text-left px-4 py-2 font-medium">#</th>
              <th className="text-left px-4 py-2 font-medium min-w-[120px]">
                Team
              </th>
              <th className="text-center px-2 py-2 font-medium">
                {labels.played}
              </th>
              <th className="text-center px-2 py-2 font-medium">
                {labels.won}
              </th>
              <th className="text-center px-2 py-2 font-medium">
                {labels.drawn}
              </th>
              <th className="text-center px-2 py-2 font-medium">
                {labels.lost}
              </th>
              <th className="text-center px-2 py-2 font-medium">
                {labels.goalsFor}
              </th>
              <th className="text-center px-2 py-2 font-medium">
                {labels.goalsAgainst}
              </th>
              <th className="text-center px-2 py-2 font-medium">
                {labels.goalDiff}
              </th>
              <th className="text-center px-2 py-2 font-medium">
                {labels.pts}
              </th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row, i) => (
              <tr
                key={row.team.id}
                className={`border-b border-border/20 ${
                  row.team.is_propeleri ? "bg-primary/10" : ""
                }`}
              >
                <td className="px-4 py-2 text-muted-foreground">{i + 1}</td>
                <td className="px-4 py-2 font-medium">
                  {row.team.name}
                  {row.team.is_propeleri && (
                    <span className="ml-1 text-primary text-xs">*</span>
                  )}
                </td>
                <td className="text-center px-2 py-2">{row.played}</td>
                <td className="text-center px-2 py-2 text-green-400">
                  {row.wins}
                </td>
                <td className="text-center px-2 py-2 text-yellow-400">
                  {row.draws}
                </td>
                <td className="text-center px-2 py-2 text-red-400">
                  {row.losses}
                </td>
                <td className="text-center px-2 py-2">{row.goals_for}</td>
                <td className="text-center px-2 py-2">{row.goals_against}</td>
                <td className="text-center px-2 py-2">
                  {row.goal_diff > 0 ? `+${row.goal_diff}` : row.goal_diff}
                </td>
                <td className="text-center px-2 py-2 font-bold">
                  {row.points}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
