/**
 * Analytic group-stage forecast (build brief, §5–§6).
 *
 * For each group this computes, per team, the probability of finishing 1st/2nd/
 * 3rd/4th, the chance of advancing as one of the top two, and expected points —
 * the model's read on "who gets out of the group" before a single pick is made.
 *
 * It is exact, not sampled: a four-team group is six matches, so there are only
 * 3^6 = 729 possible win/draw/loss combinations. We enumerate every one,
 * weight it by its probability under the {@link matchProbabilities} model, and
 * reuse {@link computeStandings} — the very same table logic the UI uses — to
 * rank each scenario. Reusing the production comparator means the forecast and
 * the live table can never disagree on how a group is ordered.
 */

import { computeStandings, generateGroupFixtures } from "@/domain/groupStage";
import { matchProbabilities } from "@/domain/probability";
import type {
  Group,
  GroupFixture,
  GroupPick,
  MatchOutcome,
  TeamId,
} from "@/domain/types";

/** Per-team probability distribution over its finishing position in a group. */
export interface TeamGroupForecast {
  readonly teamId: TeamId;
  readonly pWinGroup: number;
  readonly pRunnerUp: number;
  readonly pThird: number;
  readonly pFourth: number;
  /** Probability of finishing in the top two (automatic qualification). */
  readonly pAdvanceTop2: number;
  readonly expectedPoints: number;
  /** Probability-weighted mean finishing position, in `[1, 4]`. */
  readonly expectedFinishRank: number;
}

/** Look up a team's model rating; supplied by the caller. */
export type RatingLookup = (teamId: TeamId) => number;

const OUTCOMES: readonly MatchOutcome[] = ["HOME", "DRAW", "AWAY"];

/**
 * Forecast a group by enumerating all 729 outcome combinations.
 *
 * @param group - the four-team group to forecast.
 * @param ratingOf - rating lookup for the probability model.
 * @returns one {@link TeamGroupForecast} per team, sorted strongest-first by
 *   advancement probability. The four position probabilities each sum to 1
 *   across the group (within floating-point tolerance).
 */
export function forecastGroup(
  group: Group,
  ratingOf: RatingLookup,
): TeamGroupForecast[] {
  const fixtures = generateGroupFixtures(group);
  const outcomeProbabilities = fixtures.map((fixture) =>
    outcomeWeights(fixture, ratingOf),
  );

  const tally = new Map<TeamId, PositionTally>();
  for (const team of group.teams) tally.set(team.id, blankTally());

  const combinations = 3 ** fixtures.length;
  for (let code = 0; code < combinations; code += 1) {
    const { picks, probability } = decodeCombination(
      code,
      fixtures,
      outcomeProbabilities,
    );
    if (probability === 0) continue;

    const standings = computeStandings(group, fixtures, picks);
    for (const row of standings) {
      const teamTally = tally.get(row.teamId);
      if (!teamTally) continue;
      const slot = row.rank - 1;
      teamTally.position[slot] = (teamTally.position[slot] ?? 0) + probability;
      teamTally.expectedPoints += probability * row.points;
    }
  }

  return [...tally.entries()]
    .map(([teamId, t]) => toForecast(teamId, t))
    .sort((a, b) => b.pAdvanceTop2 - a.pAdvanceTop2);
}

interface PositionTally {
  /** Probability mass for finishing 1st…4th, indexed 0…3. */
  readonly position: number[];
  expectedPoints: number;
}

function blankTally(): PositionTally {
  return { position: [0, 0, 0, 0], expectedPoints: 0 };
}

/** The win/draw/loss probabilities for a single fixture, in OUTCOMES order. */
function outcomeWeights(
  fixture: GroupFixture,
  ratingOf: RatingLookup,
): readonly number[] {
  const probs = matchProbabilities(
    ratingOf(fixture.homeId),
    ratingOf(fixture.awayId),
  );
  return [probs.home, probs.draw, probs.away];
}

/**
 * Turn a base-3 combination code into a concrete set of picks and the joint
 * probability of that exact set of results.
 */
function decodeCombination(
  code: number,
  fixtures: readonly GroupFixture[],
  outcomeProbabilities: readonly (readonly number[])[],
): { picks: Record<string, GroupPick>; probability: number } {
  const picks: Record<string, GroupPick> = {};
  let probability = 1;
  let remaining = code;

  for (let i = 0; i < fixtures.length; i += 1) {
    const outcomeIndex = remaining % 3;
    remaining = Math.floor(remaining / 3);
    const fixture = fixtures[i];
    const outcome = OUTCOMES[outcomeIndex];
    if (!fixture || !outcome) continue;
    picks[fixture.id] = { outcome };
    probability *= outcomeProbabilities[i]?.[outcomeIndex] ?? 0;
  }

  return { picks, probability };
}

function toForecast(teamId: TeamId, tally: PositionTally): TeamGroupForecast {
  const [pWinGroup, pRunnerUp, pThird, pFourth] = tally.position as [
    number,
    number,
    number,
    number,
  ];
  const expectedFinishRank =
    pWinGroup * 1 + pRunnerUp * 2 + pThird * 3 + pFourth * 4;
  return {
    teamId,
    pWinGroup,
    pRunnerUp,
    pThird,
    pFourth,
    pAdvanceTop2: pWinGroup + pRunnerUp,
    expectedPoints: tally.expectedPoints,
    expectedFinishRank,
  };
}
