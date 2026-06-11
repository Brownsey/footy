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
import { mulberry32, samplePoisson } from "@/domain/random";
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
/** Monte-Carlo runs for the top-scorer race. */
const GOLDEN_BOOT_SIMS = 20_000;
const GOLDEN_BOOT_SEED = 0x9e3779b9;

/** A candidate's modelled Golden Boot standing. */
export interface GoldenBootOdds {
  readonly name: string;
  readonly teamId: TeamId;
  /** Expected games the player's team plays (3 group + knockout reach). */
  readonly expectedGames: number;
  /** Expected tournament goals = goals-per-game × expected games. */
  readonly expectedGoals: number;
  /**
   * Probability of finishing top scorer *among the modelled contenders*: the
   * share of Monte-Carlo tournaments in which this player outscores the rest of
   * the pool. (Among the listed pool, so the values sum to 1 — they are not the
   * absolute Golden Boot odds, which leak some mass to unlisted players.)
   */
  readonly winProbability: number;
  /** 1-based rank by win probability (1 = favourite). */
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
  const pool = candidates.map((candidate) => {
    const expectedGames = gamesByTeam.get(candidate.teamId) ?? GROUP_GAMES;
    return {
      name: candidate.name,
      teamId: candidate.teamId,
      goalsPerGame: candidate.goalsPerGame,
      expectedGames,
      expectedGoals: candidate.goalsPerGame * expectedGames,
    };
  });

  const winProbability = goldenBootWinProbabilities(pool);

  return pool
    .map((entry) => ({
      name: entry.name,
      teamId: entry.teamId,
      expectedGames: entry.expectedGames,
      expectedGoals: entry.expectedGoals,
      winProbability: winProbability.get(entry.name) ?? 0,
      rank: 0,
    }))
    .sort((a, b) => b.winProbability - a.winProbability)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

/**
 * Probability each candidate finishes top scorer of the pool, by Monte-Carlo:
 * each run draws every player's goals from a Poisson with mean
 * `goalsPerGame × expectedGames`, and the run's top scorer takes the point
 * (split evenly on a tie). Deterministic via a fixed seed.
 */
function goldenBootWinProbabilities(
  pool: readonly {
    readonly name: string;
    readonly goalsPerGame: number;
    readonly expectedGames: number;
  }[],
): Map<string, number> {
  const random = mulberry32(GOLDEN_BOOT_SEED);
  const wins = new Map<string, number>(pool.map((p) => [p.name, 0]));

  for (let run = 0; run < GOLDEN_BOOT_SIMS; run += 1) {
    let best = -1;
    let leaders: string[] = [];
    for (const player of pool) {
      const goals = samplePoisson(
        player.goalsPerGame * player.expectedGames,
        random,
      );
      if (goals > best) {
        best = goals;
        leaders = [player.name];
      } else if (goals === best) {
        leaders.push(player.name);
      }
    }
    const share = 1 / leaders.length;
    for (const name of leaders) wins.set(name, (wins.get(name) ?? 0) + share);
  }

  return new Map(
    [...wins].map(([name, total]) => [name, total / GOLDEN_BOOT_SIMS]),
  );
}
