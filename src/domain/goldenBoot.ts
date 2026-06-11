/**
 * Golden Boot forecast — the tournament top-scorer race.
 *
 * Each candidate's expected goals are their researched per-game scoring rate
 * times the number of games their team is expected to play. The games figure is
 * read straight from the Monte-Carlo simulation: three group games for everyone,
 * plus one more for each knockout round the team is expected to reach. This is
 * what makes the model more than a list of finishers — a lethal striker on a
 * side that bows out in the Round of 16 is overtaken by a steady scorer who
 * plays into the semis.
 */

import type { ScorerCandidate } from "@/data/topScorers";
import type { TeamId } from "@/domain/types";

/** The reach-stage probabilities the forecast needs from a team's simulation. */
export interface TeamReach {
  readonly teamId: TeamId;
  readonly pQualify: number;
  readonly pReachR16: number;
  readonly pReachQuarter: number;
  readonly pReachSemi: number;
  readonly pReachFinal: number;
}

/** Group games every team is guaranteed to play. */
const GROUP_GAMES = 3;

/** A candidate's modelled Golden Boot standing. */
export interface GoldenBootOdds {
  readonly name: string;
  readonly teamId: TeamId;
  /** Expected games the player's team plays (3 group + knockout reach). */
  readonly expectedGames: number;
  /** Expected tournament goals = goals-per-game × expected games. */
  readonly expectedGoals: number;
  /** 1-based rank by expected goals (1 = favourite). */
  readonly rank: number;
}

/**
 * Expected games played by each team: the three group games plus the
 * probability of reaching (and therefore playing in) each knockout round.
 */
export function expectedGamesByTeam(
  reach: readonly TeamReach[],
): ReadonlyMap<TeamId, number> {
  return new Map(
    reach.map((team) => [
      team.teamId,
      GROUP_GAMES +
        team.pQualify +
        team.pReachR16 +
        team.pReachQuarter +
        team.pReachSemi +
        team.pReachFinal,
    ]),
  );
}

/**
 * Rank the Golden Boot candidates by expected tournament goals.
 *
 * @param candidates - the scorer pool with per-game rates.
 * @param gamesByTeam - expected games per team (see {@link expectedGamesByTeam}).
 * @returns one entry per candidate, favourite-first.
 */
export function forecastGoldenBoot(
  candidates: readonly ScorerCandidate[],
  gamesByTeam: ReadonlyMap<TeamId, number>,
): GoldenBootOdds[] {
  return candidates
    .map((candidate) => {
      const expectedGames = gamesByTeam.get(candidate.teamId) ?? GROUP_GAMES;
      return {
        name: candidate.name,
        teamId: candidate.teamId,
        expectedGames,
        expectedGoals: candidate.goalsPerGame * expectedGames,
        rank: 0,
      };
    })
    .sort((a, b) => b.expectedGoals - a.expectedGoals)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}
