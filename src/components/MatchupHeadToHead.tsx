import { probabilityPercent, type InsightFactor } from "@/domain/matchupInsight";
import type { MatchScenarios } from "@/domain/probability";

/**
 * The head-to-head strip: one row per analytical dimension, with a lit dot on
 * the side each factor favours, optionally followed by profile-derived
 * "what to expect" notes. Shared by the group fixture rows and the knockout
 * bracket so every "team vs team" surface reads the same way.
 */
export function MatchupHeadToHead({
  factors,
  whatToExpect,
  expectedGoals,
  scenarios,
  sideAName,
  sideBName,
}: {
  readonly factors: readonly InsightFactor[];
  readonly whatToExpect?: readonly string[];
  readonly expectedGoals?: { readonly sideA: number; readonly sideB: number };
  readonly scenarios?: MatchScenarios;
  readonly sideAName: string;
  readonly sideBName: string;
}) {
  return (
    <section
      className="head-to-head"
      aria-label={`Head-to-head: ${sideAName} versus ${sideBName}`}
    >
      <header className="head-to-head__teams">
        <span>{sideAName}</span>
        <span>Edge</span>
        <span>{sideBName}</span>
      </header>
      {expectedGoals && (
        <p className="head-to-head__xg">
          <span>Projected goals</span>
          <strong>
            {expectedGoals.sideA.toFixed(1)} – {expectedGoals.sideB.toFixed(1)}
          </strong>
        </p>
      )}
      <ul>
        {factors.map((factor) => (
          <li
            className={`h2h-row h2h-row--${factor.edge.toLowerCase()}`}
            key={factor.label}
          >
            <span className="h2h-row__dot h2h-row__dot--a" aria-hidden="true" />
            <span className="h2h-row__label">
              {factor.label}
              <small>{factor.detail}</small>
            </span>
            <span className="h2h-row__dot h2h-row__dot--b" aria-hidden="true" />
          </li>
        ))}
      </ul>
      {scenarios && (
        <div className="head-to-head__scenarios">
          <p className="head-to-head__scenarios-title">Most likely scorelines</p>
          <ul className="head-to-head__scores">
            {scenarios.topScores.map((score) => (
              <li key={`${score.home}-${score.away}`}>
                <span>
                  {score.home}–{score.away}
                </span>
                <strong>{probabilityPercent(score.probability)}</strong>
              </li>
            ))}
          </ul>
          <p className="head-to-head__markets">
            <span>
              Both teams score{" "}
              <strong>{probabilityPercent(scenarios.bothTeamsToScore)}</strong>
            </span>
            <span>
              Over 2.5 goals{" "}
              <strong>{probabilityPercent(scenarios.overTwoPointFive)}</strong>
            </span>
          </p>
        </div>
      )}
      {whatToExpect && whatToExpect.length > 0 && (
        <div className="head-to-head__expect">
          <p className="head-to-head__expect-title">What to expect</p>
          <ul>
            {whatToExpect.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
