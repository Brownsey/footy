import { TeamName } from "@/components/TeamName";
import { getTeam } from "@/data/tournament";
import type { StandingRow } from "@/domain/types";
import { signed } from "@/utils/format";

export function StandingTable({
  table,
  complete,
  qualifiedThirdIds,
}: {
  readonly table: readonly StandingRow[];
  readonly complete: boolean;
  readonly qualifiedThirdIds: ReadonlySet<string>;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Team</th>
            <th>Pts</th>
            <th>GD</th>
            <th>GF</th>
          </tr>
        </thead>
        <tbody>
          {table.map((row) => {
            const team = getTeam(row.teamId);
            const advances =
              complete &&
              (row.rank <= 2 ||
                (row.rank === 3 && qualifiedThirdIds.has(row.teamId)));
            return (
              <tr
                className={`${complete && row.rank <= 2 ? "is-auto" : ""} ${
                  advances ? "is-qualified" : ""
                }`}
                key={row.teamId}
              >
                <td>{row.rank}</td>
                <td>
                  <TeamName team={team} compact />
                </td>
                <td>{row.points}</td>
                <td>{signed(row.goalDifference)}</td>
                <td>{row.goalsFor}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
