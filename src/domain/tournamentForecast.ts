/**
 * Draw-aware tournament forecast — the model's answer to "who wins it?"
 * (build brief, §0, §6).
 *
 * {@link forecastTitleOdds} treats the field as a neutral, strength-seeded
 * bracket. This module is the sharper instrument: it threads each team's
 * group-stage advancement probabilities (from {@link forecastGroup}) through the
 * *actual* {@link R32_LAYOUT}, then propagates those distributions round by round
 * to the Final. The result reflects the real draw geometry — the strongest seeds
 * are kept apart, so an easier side of the bracket is worth more than raw rating
 * alone implies.
 *
 * Method: every knockout slot carries a probability distribution over the teams
 * that could fill it. Two slots meeting in a tie are combined under an
 * independence assumption — for each (teamA, teamB) pair, the mass
 * `P(A here) · P(B there)` is split by the Elo win probability. The same team can
 * hold mass in two slots (e.g. as a possible winner *or* runner-up of its group);
 * those slots only meet in the Final, and such "self-match" pairs are skipped as
 * impossible, leaving a negligible, documented mass leak.
 *
 * Modelling notes:
 *  - The eight best-third slots are filled with the third-place distributions of
 *    the eight groups whose third is strongest in expectation — an approximation
 *    of FIFA's qualifying-thirds rule that barely moves title odds (thirds rarely
 *    win the cup) and keeps the calculation deterministic.
 */

import { R32_LAYOUT } from "@/domain/bracketEntrants";
import type { TitleOdds } from "@/domain/forecast";
import { forecastGroup } from "@/domain/groupForecast";
import { winProbability } from "@/domain/probability";
import type { Group, GroupId, TeamId } from "@/domain/types";

/** A probability distribution over the team that fills a knockout slot. */
type Distribution = ReadonlyMap<TeamId, number>;

/** Look up a team's model rating. */
type RatingLookup = (teamId: TeamId) => number;

/** How many third-place slots the bracket carries. */
const THIRD_SLOTS = 8;

/**
 * Forecast each team's probability of winning the tournament, accounting for the
 * real bracket draw.
 *
 * @param groups - the twelve groups (the full draw).
 * @param ratingOf - rating lookup for the probability model.
 * @returns one {@link TitleOdds} per team, favourite-first. Probabilities sum to
 *   ~1 (a small leak comes from skipping impossible self-matches).
 */
export function forecastTournament(
  groups: readonly Group[],
  ratingOf: RatingLookup,
): TitleOdds[] {
  const slotDistributions = buildEntrantDistributions(groups, ratingOf);

  let round: Distribution[] = slotDistributions;
  while (round.length > 1) {
    const next: Distribution[] = [];
    for (let tie = 0; tie < round.length; tie += 2) {
      next.push(combine(round[tie], round[tie + 1], ratingOf));
    }
    round = next;
  }

  const champions = round[0] ?? new Map<TeamId, number>();
  return [...champions.entries()]
    .map(([teamId, titleProbability]) => ({
      teamId,
      rating: ratingOf(teamId),
      titleProbability,
      rank: 0,
    }))
    .sort((a, b) => b.titleProbability - a.titleProbability)
    .map((odds, index) => ({ ...odds, rank: index + 1 }));
}

/** Build the 32 R32 entrant distributions from the layout and group forecasts. */
function buildEntrantDistributions(
  groups: readonly Group[],
  ratingOf: RatingLookup,
): Distribution[] {
  const forecasts = new Map(
    groups.map((group) => [group.id, forecastGroup(group, ratingOf)]),
  );

  const winnerDist = (groupId: GroupId): Distribution =>
    distFrom(forecasts.get(groupId), (f) => f.pWinGroup);
  const runnerUpDist = (groupId: GroupId): Distribution =>
    distFrom(forecasts.get(groupId), (f) => f.pRunnerUp);

  const thirdSlotDists = chooseThirdSlotDistributions(groups, forecasts, ratingOf);

  return R32_LAYOUT.map((slot) => {
    if (slot.kind === "winner") return winnerDist(slot.group);
    if (slot.kind === "runnerUp") return runnerUpDist(slot.group);
    return thirdSlotDists[slot.seed] ?? new Map<TeamId, number>();
  });
}

/**
 * Pick the eight groups whose third-placed team is strongest in expectation and
 * map their third-place distributions onto the eight third-slots, in seed order.
 */
function chooseThirdSlotDistributions(
  groups: readonly Group[],
  forecasts: ReadonlyMap<GroupId, ReturnType<typeof forecastGroup>>,
  ratingOf: RatingLookup,
): Distribution[] {
  const ranked = groups
    .map((group) => {
      const dist = distFrom(forecasts.get(group.id), (f) => f.pThird);
      let expectedRating = 0;
      for (const [teamId, probability] of dist) {
        expectedRating += probability * ratingOf(teamId);
      }
      return { dist, expectedRating };
    })
    .sort((a, b) => b.expectedRating - a.expectedRating)
    .slice(0, THIRD_SLOTS);

  return ranked.map((entry) => entry.dist);
}

function distFrom(
  forecast: ReturnType<typeof forecastGroup> | undefined,
  pick: (entry: ReturnType<typeof forecastGroup>[number]) => number,
): Distribution {
  const dist = new Map<TeamId, number>();
  for (const entry of forecast ?? []) dist.set(entry.teamId, pick(entry));
  return dist;
}

/**
 * Combine the two sides of a tie into the winner's distribution. Pairs where the
 * same team would face itself are impossible and skipped.
 */
function combine(
  sideA: Distribution | undefined,
  sideB: Distribution | undefined,
  ratingOf: RatingLookup,
): Distribution {
  const winner = new Map<TeamId, number>();
  if (!sideA || !sideB) return winner;

  for (const [teamA, probA] of sideA) {
    if (probA === 0) continue;
    const ratingA = ratingOf(teamA);
    for (const [teamB, probB] of sideB) {
      if (probB === 0 || teamA === teamB) continue;
      const joint = probA * probB;
      const pAWins = winProbability(ratingA, ratingOf(teamB));
      add(winner, teamA, joint * pAWins);
      add(winner, teamB, joint * (1 - pAWins));
    }
  }
  return winner;
}

function add(dist: Map<TeamId, number>, teamId: TeamId, mass: number): void {
  dist.set(teamId, (dist.get(teamId) ?? 0) + mass);
}
