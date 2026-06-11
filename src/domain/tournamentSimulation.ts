/**
 * Monte-Carlo tournament forecast — the title race the way the professional
 * supercomputers (Opta, Nate Silver's PELE) compute it.
 *
 * The neutral {@link forecastTitleOdds} ignores the draw and a closed-form
 * draw-aware propagation leaks probability mass on impossible self-matches. This
 * module instead *plays the tournament out* many times: each run
 * samples every group fixture (goals from the same bivariate-Poisson model that
 * drives the rest of the app), builds the real group tables, resolves the eight
 * best thirds and FIFA's official Round-of-32 map, then samples every knockout
 * tie to a single champion. Tallying champions over many runs gives a leak-free,
 * draw-aware title probability for each team (the counts sum to exactly 1).
 *
 * A fixed-seed PRNG keeps the whole thing reproducible: identical ratings in,
 * identical odds out, run to run — matching the determinism the rest of the app
 * relies on.
 */

import {
  officialProgressionMatches,
  roundOf32Matches,
} from "@/domain/bracket";
import { buildEntrants } from "@/domain/bracketEntrants";
import {
  computeStandings,
  generateGroupFixtures,
} from "@/domain/groupStage";
import type { PickState } from "@/domain/predictionDefaults";
import { projectedGoals, winProbability } from "@/domain/probability";
import { mulberry32, samplePoisson } from "@/domain/random";
import type { GroupSummary } from "@/domain/tournamentSummary";
import type {
  Group,
  GroupFixture,
  MatchOutcome,
  TeamId,
} from "@/domain/types";

/** Look up a team's model rating. */
type RatingLookup = (teamId: TeamId) => number;

/**
 * A team's simulated road through the tournament — the probability of reaching
 * each stage, the way the supercomputers publish it. Each is a share in `[0, 1]`
 * and the sequence is monotonically non-increasing (you must reach the semis to
 * reach the final).
 */
export interface TeamTournamentOdds {
  readonly teamId: TeamId;
  readonly rating: number;
  /** Reached the knockouts (made the Round of 32). */
  readonly pQualify: number;
  /** Reached the Round of 16. */
  readonly pReachR16: number;
  /** Reached the quarter-finals. */
  readonly pReachQuarter: number;
  /** Reached the semi-finals. */
  readonly pReachSemi: number;
  /** Reached the final. */
  readonly pReachFinal: number;
  /** Won the tournament. */
  readonly titleProbability: number;
  /** 1-based rank by title probability (1 = favourite). */
  readonly rank: number;
}

/** Stage counters per team: [qualify, R16, QF, SF, final, champion]. */
type StageCounts = [number, number, number, number, number, number];

export interface SimulationOptions {
  /** How many tournaments to play out. More = smoother tails, slower. */
  readonly iterations?: number;
  /** PRNG seed, for reproducibility. */
  readonly seed?: number;
}

const DEFAULT_ITERATIONS = 20_000;
const DEFAULT_SEED = 0x9e3779b9;

/** Stage index reached by winning a tie in the given official round. */
const REACH_STAGE_BY_ROUND: Readonly<Record<string, number>> = {
  R32: 1,
  R16: 2,
  QF: 3,
  SF: 4,
  FINAL: 5,
};

/**
 * The knockout reduced to a flat, ordered plan computed once: the 16 R32 ties
 * (by entrant index) followed by every winner-fed progression tie in dependency
 * order, up to the Final (M104). The third-place play-off is irrelevant to the
 * champion and dropped. Resolving a simulated bracket is then a single forward
 * pass over this plan — no per-tie object churn.
 */
const KNOCKOUT_PLAN = buildKnockoutPlan();

/**
 * Forecast each team's road through the tournament by Monte-Carlo simulation
 * through the real draw. Title probabilities sum to 1 (every run produces
 * exactly one champion); reach-stage shares sum to the slots per round
 * (32 qualify, 16 reach the R16, …, 2 reach the final).
 */
export function simulateTournament(
  groups: readonly Group[],
  ratingOf: RatingLookup,
  options: SimulationOptions = {},
): TeamTournamentOdds[] {
  const iterations = options.iterations ?? DEFAULT_ITERATIONS;
  const random = mulberry32(options.seed ?? DEFAULT_SEED);
  // Fixtures depend only on the draw, so generate them once and reuse.
  const fixturesByGroup = groups.map((group) => ({
    group,
    fixtures: generateGroupFixtures(group),
  }));

  const counts = new Map<TeamId, StageCounts>();
  const bump = (teamId: TeamId, stage: number): void => {
    let row = counts.get(teamId);
    if (!row) {
      row = [0, 0, 0, 0, 0, 0];
      counts.set(teamId, row);
    }
    row[stage] = (row[stage] ?? 0) + 1;
  };

  for (let run = 0; run < iterations; run += 1) {
    simulateOnce(fixturesByGroup, ratingOf, random, bump);
  }

  const empty: StageCounts = [0, 0, 0, 0, 0, 0];
  return groups
    .flatMap((group) => group.teams)
    .map((team) => {
      const row = counts.get(team.id) ?? empty;
      return {
        teamId: team.id,
        rating: ratingOf(team.id),
        pQualify: row[0] / iterations,
        pReachR16: row[1] / iterations,
        pReachQuarter: row[2] / iterations,
        pReachSemi: row[3] / iterations,
        pReachFinal: row[4] / iterations,
        titleProbability: row[5] / iterations,
        rank: 0,
      };
    })
    .sort((a, b) => b.titleProbability - a.titleProbability)
    .map((odds, index) => ({ ...odds, rank: index + 1 }));
}

/** Play one tournament out, recording every stage each team reaches via `bump`. */
function simulateOnce(
  fixturesByGroup: readonly {
    readonly group: Group;
    readonly fixtures: readonly GroupFixture[];
  }[],
  ratingOf: RatingLookup,
  random: () => number,
  bump: (teamId: TeamId, stage: number) => void,
): void {
  const picks: PickState = {};
  const summaries: GroupSummary[] = fixturesByGroup.map(
    ({ group, fixtures }) => {
      for (const fixture of fixtures) {
        const goals = projectedGoals(
          ratingOf(fixture.homeId),
          ratingOf(fixture.awayId),
        );
        const home = samplePoisson(goals.home, random);
        const away = samplePoisson(goals.away, random);
        const outcome: MatchOutcome =
          home > away ? "HOME" : home < away ? "AWAY" : "DRAW";
        picks[fixture.id] = { outcome, scoreline: { home, away } };
      }
      return {
        group,
        fixtures,
        table: computeStandings(group, fixtures, picks),
        picked: fixtures.length,
        complete: true,
      };
    },
  );

  const entrants = buildEntrants(summaries);
  // Everyone in the R32 has qualified for the knockouts (stage 0).
  for (const entrant of entrants) if (entrant) bump(entrant, 0);
  resolveSampledKnockout(entrants, ratingOf, random, bump);
}

/**
 * A knockout tie in the resolution plan: where its two sides come from, and the
 * stage index a team has reached by *winning* it (R32 win → reached R16 = 1, up
 * to Final win → champion = 5).
 */
type PlanStep = {
  readonly id: string;
  readonly reachStage: number;
} & (
  | { readonly fromEntrants: readonly [number, number] }
  | { readonly fromMatches: readonly [string, string] }
);

function buildKnockoutPlan(): PlanStep[] {
  const plan: PlanStep[] = roundOf32Matches.map((fixture, index) => ({
    id: fixture.id,
    reachStage: REACH_STAGE_BY_ROUND.R32!,
    fromEntrants: [index * 2, index * 2 + 1] as const,
  }));
  for (const fixture of officialProgressionMatches) {
    // The champion's path is winner-fed only; skip the third-place play-off.
    if (fixture.sideA.kind !== "matchWinner") continue;
    if (fixture.sideB.kind !== "matchWinner") continue;
    const reachStage = REACH_STAGE_BY_ROUND[fixture.round];
    if (reachStage === undefined) continue;
    plan.push({
      id: fixture.id,
      reachStage,
      fromMatches: [fixture.sideA.matchId, fixture.sideB.matchId],
    });
  }
  return plan;
}

/**
 * Resolve a simulated bracket in one forward pass over {@link KNOCKOUT_PLAN},
 * sampling each tie's winner by Elo win probability and recording the stage each
 * winner reaches via `bump`.
 */
function resolveSampledKnockout(
  entrants: readonly (TeamId | undefined)[],
  ratingOf: RatingLookup,
  random: () => number,
  bump: (teamId: TeamId, stage: number) => void,
): void {
  const winnerByMatch = new Map<string, TeamId>();
  for (const step of KNOCKOUT_PLAN) {
    const [home, away] =
      "fromEntrants" in step
        ? [entrants[step.fromEntrants[0]], entrants[step.fromEntrants[1]]]
        : [
            winnerByMatch.get(step.fromMatches[0]),
            winnerByMatch.get(step.fromMatches[1]),
          ];
    const winnerId = sampleWinner(home, away, ratingOf, random);
    if (winnerId) {
      winnerByMatch.set(step.id, winnerId);
      bump(winnerId, step.reachStage);
    }
  }
}

/** Sample a tie winner; if one side is missing the other walks through. */
function sampleWinner(
  home: TeamId | undefined,
  away: TeamId | undefined,
  ratingOf: RatingLookup,
  random: () => number,
): TeamId | undefined {
  if (!home) return away;
  if (!away) return home;
  const pHome = winProbability(ratingOf(home), ratingOf(away));
  return random() < pHome ? home : away;
}

