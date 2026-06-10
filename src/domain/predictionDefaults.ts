import {
  matchProbabilities,
  mostLikelyScoreline,
} from "./probability";
import type {
  GroupFixture,
  GroupPick,
  MatchOutcome,
  Scoreline,
} from "./types";

export type PickState = Record<string, GroupPick>;

/** Rating lookup for a team, used to drive model-based seeding. */
export type RatingLookup = (teamId: string) => number;

/**
 * Win-probability gap below which a fixture is seeded as a draw. The draw band
 * peaks (~0.30) below the level-match decisive split (~0.35 each), so a pure
 * "modal outcome" read would *never* seed a draw — every level game would become
 * a coin-flip home win. Instead, when the two sides' win probabilities are this
 * close the most defensible single call is a draw, which also restores realistic
 * draw frequency to the seeded card.
 */
const DRAW_MARGIN = 0.06;

/**
 * The model's most likely outcome for a fixture, from the first side's
 * perspective. Reads the shared probability engine so seeding agrees with the
 * insight panel and the Claude Predicts sets; genuinely level ties (win
 * probabilities within {@link DRAW_MARGIN}) are seeded as draws.
 */
export function modelOutcome(ratingA: number, ratingB: number): MatchOutcome {
  const probs = matchProbabilities(ratingA, ratingB);
  if (Math.abs(probs.home - probs.away) < DRAW_MARGIN) return "DRAW";
  return probs.home > probs.away ? "HOME" : "AWAY";
}

/**
 * The scoreline to pre-fill when a result is chosen for a fixture. Rather than a
 * flat "winner 2–1", this is the single most likely *exact* scoreline for the
 * two teams consistent with `outcome` (Poisson over their projected goals), so
 * modest favourites suggest 1–0, clear favourites 2–0/2–1 and mismatches 3–0 —
 * matching the real World Cup scoreline spread instead of defaulting to 2–1.
 */
export function modelScoreline(
  ratingA: number,
  ratingB: number,
  outcome: MatchOutcome,
): Scoreline {
  return mostLikelyScoreline(ratingA, ratingB, outcome);
}

export function buildSeededPicks(
  fixtureGroups: readonly {
    readonly fixtures: readonly GroupFixture[];
  }[],
  getRating: RatingLookup,
): PickState {
  const seededPicks: PickState = {};
  for (const { fixtures } of fixtureGroups) {
    for (const fixture of fixtures) {
      const ratingA = getRating(fixture.homeId);
      const ratingB = getRating(fixture.awayId);
      const outcome = modelOutcome(ratingA, ratingB);
      seededPicks[fixture.id] = {
        outcome,
        scoreline: modelScoreline(ratingA, ratingB, outcome),
      };
    }
  }
  return seededPicks;
}
