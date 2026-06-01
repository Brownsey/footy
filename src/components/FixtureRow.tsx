import type { ChangeEvent } from "react";

import { MatchupHeadToHead } from "@/components/MatchupHeadToHead";
import { TeamName } from "@/components/TeamName";
import { getTeam } from "@/data/tournament";
import { getTeamProfile } from "@/data/teamProfiles";
import {
  getMatchupInsight,
  probabilityPercent,
  type OutcomeInsight,
} from "@/domain/matchupInsight";
import type {
  GroupFixture,
  GroupPick,
  MatchOutcome,
  Scoreline,
  Team,
} from "@/domain/types";

export function FixtureRow({
  fixture,
  pick,
  onOutcomeChange,
  onScoreChange,
}: {
  readonly fixture: GroupFixture;
  readonly pick: GroupPick | undefined;
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
  const sideA = getTeam(fixture.homeId);
  const sideB = getTeam(fixture.awayId);
  const scoreline = pick?.scoreline;
  // Hosts play all their group games at home — fold that into the insight.
  const hostSide = sideA.host ? "A" : sideB.host ? "B" : undefined;
  const insight = getMatchupInsight(
    { team: sideA, profile: getTeamProfile(sideA.id) },
    { team: sideB, profile: getTeamProfile(sideB.id) },
    hostSide ? { hostSide } : {},
  );
  const {
    HOME: sideAInsight,
    DRAW: drawInsight,
    AWAY: sideBInsight,
  } = insight.outcomes;

  return (
    <div className={`fixture-row ${pick ? "has-pick" : ""}`}>
      <div className="fixture-row__meta">
        <span>Matchday {fixture.matchday}</span>
        <strong>
          {pick ? outcomeLabel(pick.outcome, sideA, sideB) : insight.summary}
        </strong>
      </div>

      <div
        className="match-picker"
        aria-label={`${sideA.name} versus ${sideB.name}`}
      >
        <button
          className={`team-option ${pick?.outcome === "HOME" ? "is-selected" : ""}`}
          onClick={() => onOutcomeChange(fixture, "HOME")}
          type="button"
        >
          <TeamName team={sideA} />
          <OutcomeCopy insight={sideAInsight} />
        </button>

        <div className="score-control">
          <input
            aria-label={`${sideA.name} goals`}
            inputMode="numeric"
            max={12}
            min={0}
            onChange={(event) => onScoreChange(fixture, "home", event)}
            type="number"
            value={scoreline?.home ?? ""}
          />
          <span aria-hidden="true">-</span>
          <input
            aria-label={`${sideB.name} goals`}
            inputMode="numeric"
            max={12}
            min={0}
            onChange={(event) => onScoreChange(fixture, "away", event)}
            type="number"
            value={scoreline?.away ?? ""}
          />
        </div>

        <button
          className={`draw-option ${pick?.outcome === "DRAW" ? "is-selected" : ""}`}
          onClick={() => onOutcomeChange(fixture, "DRAW")}
          type="button"
        >
          <strong>Draw</strong>
          <OutcomeCopy insight={drawInsight} />
        </button>

        <button
          className={`team-option team-option--right ${
            pick?.outcome === "AWAY" ? "is-selected" : ""
          }`}
          onClick={() => onOutcomeChange(fixture, "AWAY")}
          type="button"
        >
          <TeamName team={sideB} align="right" />
          <OutcomeCopy insight={sideBInsight} />
        </button>
      </div>

      <details className="fixture-insight">
        <summary>Compare model and team notes</summary>
        <MatchupHeadToHead
          factors={insight.keyFactors}
          whatToExpect={insight.whatToExpect}
          sideAName={sideA.name}
          sideBName={sideB.name}
        />
        <div className="fixture-insight__grid">
          <TeamInsightCard side={insight.sideA} />
          <OutcomeInsightCard insight={sideAInsight} />
          <OutcomeInsightCard insight={drawInsight} />
          <OutcomeInsightCard insight={sideBInsight} />
          <TeamInsightCard side={insight.sideB} align="right" />
        </div>
      </details>
    </div>
  );
}

function OutcomeCopy({
  insight,
}: {
  readonly insight: OutcomeInsight | undefined;
}) {
  if (!insight) return null;
  return (
    <span className="outcome-copy">
      <strong>{probabilityPercent(insight.probability)}</strong>
      <span>{insight.reasons[0]}</span>
    </span>
  );
}

function TeamInsightCard({
  side,
  align = "left",
}: {
  readonly side: ReturnType<typeof getMatchupInsight>["sideA"];
  readonly align?: "left" | "right";
}) {
  return (
    <section className={`team-insight team-insight--${align}`}>
      <TeamName team={side.team} align={align} />
      <p>{side.profile.narrative}</p>
      <dl>
        <div>
          <dt>FIFA rank</dt>
          <dd>#{side.profile.fifaRanking}</dd>
        </div>
        <div>
          <dt>Rating</dt>
          <dd>{side.profile.modelRating}</dd>
        </div>
        <div>
          <dt>Route</dt>
          <dd>{side.profile.qualificationRoute}</dd>
        </div>
        <div>
          <dt>Pedigree</dt>
          <dd>{side.profile.worldCupPedigree}</dd>
        </div>
        <div>
          <dt>Form</dt>
          <dd>{side.profile.recentForm}</dd>
        </div>
        <div>
          <dt>Key players</dt>
          <dd>{side.profile.keyPlayers.join(", ")}</dd>
        </div>
      </dl>
      <ul>
        <li>{side.profile.strengths[0]}</li>
        <li>{side.profile.weaknesses[0]}</li>
      </ul>
    </section>
  );
}

function OutcomeInsightCard({
  insight,
}: {
  readonly insight: OutcomeInsight | undefined;
}) {
  if (!insight) return null;
  return (
    <section className="outcome-insight-card">
      <div>
        <span>{insight.label}</span>
        <strong>{probabilityPercent(insight.probability)}</strong>
      </div>
      <ul>
        {insight.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
    </section>
  );
}

function outcomeLabel(outcome: MatchOutcome, sideA: Team, sideB: Team): string {
  switch (outcome) {
    case "HOME":
      return `${sideA.name} win`;
    case "AWAY":
      return `${sideB.name} win`;
    case "DRAW":
      return "Draw selected";
  }
}
