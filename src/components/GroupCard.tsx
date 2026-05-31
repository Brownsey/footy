import type { ChangeEvent } from "react";

import { FixtureRow } from "@/components/FixtureRow";
import { StandingTable } from "@/components/StandingTable";
import type { TeamGroupForecast } from "@/domain/groupForecast";
import type { PickState } from "@/domain/predictionDefaults";
import type { GroupSummary } from "@/domain/tournamentSummary";
import type { GroupFixture, MatchOutcome, Scoreline } from "@/domain/types";

export function GroupCard({
  summary,
  picks,
  forecast,
  qualifiedThirdIds,
  onOutcomeChange,
  onScoreChange,
}: {
  readonly summary: GroupSummary;
  readonly picks: PickState;
  readonly forecast: readonly TeamGroupForecast[];
  readonly qualifiedThirdIds: ReadonlySet<string>;
  readonly onOutcomeChange: (
    fixture: GroupFixture,
    outcome: MatchOutcome,
  ) => void;
  readonly onScoreChange: (
    fixture: GroupFixture,
    side: keyof Scoreline,
    event: ChangeEvent<HTMLInputElement>,
  ) => void;
}) {
  return (
    <article className={`group-card ${summary.complete ? "is-complete" : ""}`}>
      <header className="group-card__header">
        <div>
          <span className="group-card__kicker">Group {summary.group.id}</span>
          <h3>{summary.group.teams.map((team) => team.name).join(" / ")}</h3>
        </div>
        <span className="status-pill">
          {summary.complete ? "Complete" : `${summary.picked}/6`}
        </span>
      </header>

      <div className="fixture-list">
        {summary.fixtures.map((fixture) => (
          <FixtureRow
            key={fixture.id}
            fixture={fixture}
            pick={picks[fixture.id]}
            onOutcomeChange={onOutcomeChange}
            onScoreChange={onScoreChange}
          />
        ))}
      </div>

      <StandingTable
        complete={summary.complete}
        forecast={forecast}
        qualifiedThirdIds={qualifiedThirdIds}
        table={summary.table}
      />
    </article>
  );
}
