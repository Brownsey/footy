import { TeamName } from "@/components/TeamName";
import { getTeam } from "@/data/tournament";
import type { TeamGroupForecast } from "@/domain/groupForecast";
import type { StandingRow, TeamId } from "@/domain/types";
import { percent, signed } from "@/utils/format";

export function StandingTable({
  table,
  complete,
  forecast,
  qualifiedThirdIds,
}: {
  readonly table: readonly StandingRow[];
  readonly complete: boolean;
  readonly forecast: readonly TeamGroupForecast[];
  readonly qualifiedThirdIds: ReadonlySet<string>;
}) {
  const advanceOdds = new Map<TeamId, number>(
    forecast.map((entry) => [entry.teamId, entry.pAdvanceTop2]),
  );

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
            <th title="Model probability of finishing in the top two before any picks">
              Adv
            </th>
          </tr>
        </thead>
        <tbody>
          {table.map((row) => {
            const team = getTeam(row.teamId);
            const advances =
              complete &&
              (row.rank <= 2 ||
                (row.rank === 3 && qualifiedThirdIds.has(row.teamId)));
            const advanceProbability = advanceOdds.get(row.teamId);
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
                <td className="standing-odds">
                  {advanceProbability === undefined
                    ? "—"
                    : percent(advanceProbability, 0)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
