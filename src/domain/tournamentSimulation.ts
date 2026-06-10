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
import type { GroupSummary } from "@/domain/tournamentSummary";
import type {
  Group,
  GroupFixture,
  MatchOutcome,
  TeamId,
} from "@/domain/types";

/** Look up a team's model rating. */
type RatingLookup = (teamId: TeamId) => number;

/** A team's simulated chance of winning the tournament. */
export interface SimulatedTitleOdds {
  readonly teamId: TeamId;
  readonly rating: number;
  /** Share of simulated tournaments this team won, in `[0, 1]`. */
  readonly titleProbability: number;
  /** 1-based rank by title probability (1 = favourite). */
  readonly rank: number;
}

export interface SimulationOptions {
  /** How many tournaments to play out. More = smoother tails, slower. */
  readonly iterations?: number;
  /** PRNG seed, for reproducibility. */
  readonly seed?: number;
}

const DEFAULT_ITERATIONS = 20_000;
const DEFAULT_SEED = 0x9e3779b9;

/**
 * The knockout reduced to a flat, ordered plan computed once: the 16 R32 ties
 * (by entrant index) followed by every winner-fed progression tie in dependency
 * order, up to the Final (M104). The third-place play-off is irrelevant to the
 * champion and dropped. Resolving a simulated bracket is then a single forward
 * pass over this plan — no per-tie object churn.
 */
const KNOCKOUT_PLAN = buildKnockoutPlan();

/**
 * Forecast each team's title probability by Monte-Carlo simulation through the
 * real draw. Probabilities sum to 1 (every run produces exactly one champion).
 */
export function simulateTournament(
  groups: readonly Group[],
  ratingOf: RatingLookup,
  options: SimulationOptions = {},
): SimulatedTitleOdds[] {
  const iterations = options.iterations ?? DEFAULT_ITERATIONS;
  const random = mulberry32(options.seed ?? DEFAULT_SEED);
  // Fixtures depend only on the draw, so generate them once and reuse.
  const fixturesByGroup = groups.map((group) => ({
    group,
    fixtures: generateGroupFixtures(group),
  }));
  const wins = new Map<TeamId, number>();

  for (let run = 0; run < iterations; run += 1) {
    const champion = simulateOnce(fixturesByGroup, ratingOf, random);
    if (champion) wins.set(champion, (wins.get(champion) ?? 0) + 1);
  }

  return groups
    .flatMap((group) => group.teams)
    .map((team) => ({
      teamId: team.id,
      rating: ratingOf(team.id),
      titleProbability: (wins.get(team.id) ?? 0) / iterations,
      rank: 0,
    }))
    .sort((a, b) => b.titleProbability - a.titleProbability)
    .map((odds, index) => ({ ...odds, rank: index + 1 }));
}

/** Play one tournament to completion and return its champion. */
function simulateOnce(
  fixturesByGroup: readonly {
    readonly group: Group;
    readonly fixtures: readonly GroupFixture[];
  }[],
  ratingOf: RatingLookup,
  random: () => number,
): TeamId | undefined {
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
  return resolveSampledKnockout(entrants, ratingOf, random);
}

/** A resolved knockout tie: where its two sides come from, keyed by match id. */
type PlanStep =
  | { readonly id: string; readonly fromEntrants: readonly [number, number] }
  | { readonly id: string; readonly fromMatches: readonly [string, string] };

function buildKnockoutPlan(): PlanStep[] {
  const plan: PlanStep[] = roundOf32Matches.map((fixture, index) => ({
    id: fixture.id,
    fromEntrants: [index * 2, index * 2 + 1] as const,
  }));
  for (const fixture of officialProgressionMatches) {
    // The champion's path is winner-fed only; skip the third-place play-off.
    if (fixture.sideA.kind !== "matchWinner") continue;
    if (fixture.sideB.kind !== "matchWinner") continue;
    plan.push({
      id: fixture.id,
      fromMatches: [fixture.sideA.matchId, fixture.sideB.matchId],
    });
  }
  return plan;
}

/**
 * Resolve a simulated bracket in one forward pass over {@link KNOCKOUT_PLAN},
 * sampling each tie's winner by Elo win probability. Returns the Final winner.
 */
function resolveSampledKnockout(
  entrants: readonly (TeamId | undefined)[],
  ratingOf: RatingLookup,
  random: () => number,
): TeamId | undefined {
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
    if (winnerId) winnerByMatch.set(step.id, winnerId);
  }
  return winnerByMatch.get("M104");
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

/** Draw a Poisson sample with mean `lambda` (Knuth's method). */
function samplePoisson(lambda: number, random: () => number): number {
  const limit = Math.exp(-lambda);
  let count = 0;
  let product = 1;
  do {
    count += 1;
    product *= random();
  } while (product > limit);
  return count - 1;
}

/** mulberry32 — a small, fast, deterministic 32-bit PRNG in `[0, 1)`. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
