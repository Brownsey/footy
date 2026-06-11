import { matchProbabilities, sampledScoreline } from "./probability";
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
 * close the most defensible single call is a draw.
 *
 * Calibrated to 0.14 so ~19% of the 72 group fixtures seed as draws, matching
 * the historical World Cup group-stage draw rate (~16–22%; 2018 was 16%). A
 * lower threshold under-produced draws (0.06 → 6%); higher over-produced them
 * (0.18 → 29%).
 */
const DRAW_MARGIN = 0.14;

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
 * The scoreline to pre-fill when a result is chosen for a fixture. Drawn from
 * the two teams' projected goals (a deterministic Poisson sample consistent with
 * `outcome`), so a loaded card shows the real spread of results — a quarter
 * 1–0, a fifth 2–1, then 2–0, 3–0, 1–1 — rather than a column of modal 1–0s.
 */
export function modelScoreline(
  ratingA: number,
  ratingB: number,
  outcome: MatchOutcome,
): Scoreline {
  return sampledScoreline(ratingA, ratingB, outcome);
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
