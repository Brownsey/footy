/**
 * "Claude Predicts" — ten philosophy-driven prediction sets (build brief, §7).
 *
 * Each philosophy is a distinct, stated way of reading the tournament. Rather
 * than hand-authoring ten brackets, every philosophy is expressed as a pure
 * re-rating of the 48 teams: it nudges each team's base model rating up or down
 * using the researched {@link TeamProfile} data (form, pedigree, star power,
 * defensive profile, host status, group strength, …). Those adjusted ratings
 * then flow through the *same* probability and forecast engines the rest of the
 * app uses, so each set yields:
 *
 *   - a full, deterministic set of group-stage picks (selectable as a start
 *     point the user can then edit), and
 *   - a projected champion (the favourite under that philosophy's ratings).
 *
 * Everything is reproducible: same data in, same ten sets out.
 */

import type { HomeClimate, TeamProfile } from "@/data/teamProfiles";
import { resolveBracket, type WinnerPicks } from "@/domain/bracket";
import { buildEntrants } from "@/domain/bracketEntrants";
import {
  computeStandings,
  generateGroupFixtures,
  isGroupComplete,
} from "@/domain/groupStage";
import type { PickState } from "@/domain/predictionDefaults";
import { matchProbabilities } from "@/domain/probability";
import type { GroupSummary } from "@/domain/tournamentSummary";
import type {
  Group,
  GroupPick,
  MatchOutcome,
  Scoreline,
  Team,
  TeamId,
} from "@/domain/types";

/** Read-only inputs a philosophy can use beyond a single team's own profile. */
export interface PhilosophyContext {
  /** Mean base rating across the whole field. */
  readonly fieldMeanRating: number;
  /** Average rating of a team's three group opponents (group difficulty). */
  readonly groupStrength: ReadonlyMap<TeamId, number>;
  /** 1-based rank of a team by base rating (1 = strongest in the field). */
  readonly ratingRank: ReadonlyMap<TeamId, number>;
}

/** A single, stated way of reading the tournament. */
export interface Philosophy {
  readonly id: string;
  readonly name: string;
  readonly rationale: string;
  /** Map a team's base rating to this philosophy's adjusted rating. */
  readonly adjust: (
    profile: TeamProfile,
    team: Team,
    context: PhilosophyContext,
  ) => number;
}

/** A fully-realised prediction set produced from a {@link Philosophy}. */
export interface PredictionSet {
  readonly id: string;
  readonly name: string;
  readonly rationale: string;
  readonly championId: TeamId;
  /** Group-stage picks, ready to load as a starting point. */
  readonly picks: PickState;
  /**
   * Knockout winner picks (R32 → Final) under this philosophy's ratings, wired
   * through FIFA's official bracket. Loading a set therefore populates the
   * whole bracket, and {@link championId} is exactly the team this bracket
   * crowns — not a guess from a separate, neutral seeding.
   */
  readonly knockoutPicks: WinnerPicks;
}

type ProfileLookup = (teamId: TeamId) => TeamProfile;

const STAR_NAMES = [
  "Messi",
  "Mbappe",
  "Haaland",
  "Yamal",
  "Bellingham",
  "Salah",
  "Vinicius",
  "Kane",
  "Ronaldo",
  "Pedri",
  "Rodri",
  "Modric",
  "De Bruyne",
  "Musiala",
  "Wirtz",
  "Odegaard",
  "Son",
  "Isak",
] as const;

const POSITIVE_FORM =
  /\b(won|win|topped?|unbeaten|perfect|dominant|dominated|stormed|storming|surged|resurgent|flying|comfortab|cruised|demolished|strong)\b/i;
const NEGATIVE_FORM =
  /\b(stuttered?|wobbl|mixed|uneven|streaky|poor|edged|survived|playoff|pragmatic|cautious)\b/i;
const DEFENSIVE =
  /\b(defen|organis|organiz|compact|resilien|structure|structured|solid|miserly|disciplin|block)\b/i;
const CHAMPION_PEDIGREE = /\bchampions?\b/i;
const FINALIST_PEDIGREE = /\b(runners-up|final)\b/i;
const SEMI_PEDIGREE = /\b(semi-final|fourth place|third place|bronze)\b/i;
const QUARTER_PEDIGREE = /\bquarter-final/i;
const DEBUT_PEDIGREE = /\bdebut\b/i;

/**
 * The ten philosophies. Each `adjust` returns an adjusted rating; deltas are in
 * Elo points, so they are directly comparable to the base ratings.
 */
export const PHILOSOPHIES: readonly Philosophy[] = [
  {
    id: "chalk",
    name: "Chalk",
    rationale:
      "Ranking-led. The higher-rated team always goes through — the bookmakers' baseline with no romance.",
    adjust: (profile) => profile.modelRating,
  },
  {
    id: "form",
    name: "Form over reputation",
    rationale:
      "Momentum beats history. Teams arriving hot are boosted; those stuttering into the finals are marked down.",
    adjust: (profile) =>
      profile.modelRating +
      formSignal(`${profile.recentForm} ${profile.narrative}`),
  },
  {
    id: "underdog",
    name: "Underdog-friendly",
    rationale:
      "Lean into the chaos. The elite favourites are faded, debutants and lower seeds get a lift, and a genuine dark horse — not the top seed — is backed to go all the way.",
    adjust: (profile, team, ctx) => {
      // Fade the established elite so their edge no longer carries the bracket…
      const rank = ctx.ratingRank.get(team.id) ?? 99;
      const eliteFade = rank <= 4 ? -200 : rank <= 8 ? -90 : 0;
      // …and lift the dark horses: pot-2 sides are the prime upset picks, with
      // pot-3/4 and debutants nudged up too.
      const darkHorse = team.pot === 2 ? 110 : team.pot >= 3 ? 70 : 0;
      const debutBonus = team.debutant ? 60 : 0;
      const compression = (ctx.fieldMeanRating - profile.modelRating) * 0.2;
      return (
        profile.modelRating + eliteFade + darkHorse + debutBonus + compression
      );
    },
  },
  {
    id: "defensive",
    name: "Defensive-record-led",
    rationale:
      "Tournaments are won at the back. Reward sides built on organisation; fade those with a soft underbelly.",
    adjust: (profile) => {
      const strong = profile.strengths.some((s) => DEFENSIVE.test(s)) ? 80 : 0;
      const leaky = profile.weaknesses.some((w) => DEFENSIVE.test(w)) ? -50 : 0;
      return profile.modelRating + strong + leaky;
    },
  },
  {
    id: "star-power",
    name: "Star power",
    rationale:
      "One match-winner can decide a knockout. Teams carrying genuine talismen are boosted.",
    adjust: (profile) => profile.modelRating + starSignal(profile.keyPlayers),
  },
  {
    id: "host",
    name: "Host advantage",
    rationale:
      "Home soil is decisive. The three hosts ride the crowd, climate and minimal travel all the way — backed to lift the trophy on home turf — with their CONCACAF neighbours boosted too.",
    adjust: (profile, team) => {
      // A bold lens: the host boost is large enough to carry a host nation past
      // the field's top seed, so this philosophy actually crowns a host.
      const host = team.host ? 180 : 0;
      const homeContinent =
        team.confederation === "CONCACAF" && !team.host ? 70 : 0;
      return profile.modelRating + host + homeContinent;
    },
  },
  {
    id: "pedigree",
    name: "Tournament pedigree",
    rationale:
      "Serial deep-runners know how to win the games that matter. Champions and finalists of old get the nod.",
    adjust: (profile) =>
      profile.modelRating + pedigreeSignal(profile.worldCupPedigree),
  },
  {
    id: "group-of-death",
    name: "Group-of-death survivors",
    rationale:
      "Battle-hardening pays off. Teams that come through the toughest groups carry that momentum forward.",
    adjust: (profile, team, ctx) => {
      const difficulty =
        (ctx.groupStrength.get(team.id) ?? ctx.fieldMeanRating) -
        ctx.fieldMeanRating;
      return profile.modelRating + difficulty * 0.4;
    },
  },
  {
    id: "heat-travel",
    name: "Heat & travel",
    rationale:
      "A vast, hot, well-travelled tournament across North America. Heat-acclimatised sides and those with the least travel from the host region are favoured; cool-climate, long-haul teams are marked down.",
    adjust: (profile, team) =>
      profile.modelRating +
      climateSignal(profile.homeClimate) +
      travelSignal(team.confederation),
  },
  {
    id: "contrarian",
    name: "Contrarian",
    rationale:
      "Fade the obvious. The top two favourites are deliberately marked down to open the door for a bold winner.",
    adjust: (profile, team, ctx) => {
      const rank = ctx.ratingRank.get(team.id) ?? 99;
      if (rank <= 2) return profile.modelRating - 180;
      if (rank <= 6) return profile.modelRating - 40;
      if (team.pot === 2) return profile.modelRating + 50;
      return profile.modelRating;
    },
  },
];

/**
 * Build all ten prediction sets for the given draw.
 *
 * @param groups - the twelve groups (the full draw).
 * @param getProfile - profile lookup for the 48 teams.
 * @returns one {@link PredictionSet} per philosophy, in declared order.
 */
export function buildPredictionSets(
  groups: readonly Group[],
  getProfile: ProfileLookup,
): PredictionSet[] {
  const teams = groups.flatMap((group) => group.teams);
  const context = buildContext(groups, getProfile);

  return PHILOSOPHIES.map((philosophy) => {
    const ratingOf = new Map<TeamId, number>(
      teams.map((team) => [
        team.id,
        philosophy.adjust(getProfile(team.id), team, context),
      ]),
    );
    const rating = (teamId: TeamId): number =>
      ratingOf.get(teamId) ?? context.fieldMeanRating;

    const picks = buildGroupPicks(groups, rating);

    // The same ratings that drove the group picks now flow through the *real*
    // FIFA bracket: group tables → official R32 slots (incl. Annexe C thirds) →
    // every knockout tie resolved by rating. The champion is whatever this
    // bracket crowns, so the projected winner is always reachable from — and
    // consistent with — the picks the user loads.
    const summaries = buildSummaries(groups, picks);
    const entrants = buildEntrants(summaries);
    const { knockoutPicks, championId } = predictKnockout(entrants, rating);

    return {
      id: philosophy.id,
      name: philosophy.name,
      rationale: philosophy.rationale,
      championId: championId ?? teams[0]?.id ?? "",
      picks,
      knockoutPicks,
    };
  });
}

/** Build group summaries from a philosophy's full slate of group picks. */
function buildSummaries(
  groups: readonly Group[],
  picks: PickState,
): GroupSummary[] {
  return groups.map((group) => {
    const fixtures = generateGroupFixtures(group);
    return {
      group,
      fixtures,
      table: computeStandings(group, fixtures, picks),
      picked: fixtures.filter((fixture) => picks[fixture.id]).length,
      complete: isGroupComplete(fixtures, picks),
    };
  });
}

/**
 * Walk FIFA's official knockout bracket, resolving every tie deterministically
 * by the philosophy's ratings (higher rating advances; ties broken by team id
 * for stability). Returns the winner picks and the crowned champion.
 */
function predictKnockout(
  entrants: readonly (TeamId | undefined)[],
  rating: (teamId: TeamId) => number,
): { knockoutPicks: WinnerPicks; championId: TeamId | undefined } {
  let picks: WinnerPicks = {};
  let bracket = resolveBracket(entrants, picks);

  // Each pass decides ties whose both sides are now known; resolving a round
  // reveals the next. Five passes (R32 → Final) suffice, but loop to a stable
  // state defensively.
  for (let pass = 0; pass < bracket.matches.length; pass += 1) {
    let changed = false;
    for (const tie of bracket.matches) {
      if (picks[tie.id] || !tie.homeId || !tie.awayId) continue;
      picks = { ...picks, [tie.id]: favoured(tie.homeId, tie.awayId, rating) };
      changed = true;
    }
    if (!changed) break;
    bracket = resolveBracket(entrants, picks);
  }

  return { knockoutPicks: bracket.winners, championId: bracket.championId };
}

/** The higher-rated team, tie-broken deterministically by team id. */
function favoured(
  homeId: TeamId,
  awayId: TeamId,
  rating: (teamId: TeamId) => number,
): TeamId {
  const delta = rating(homeId) - rating(awayId);
  if (delta !== 0) return delta > 0 ? homeId : awayId;
  return homeId < awayId ? homeId : awayId;
}

function buildContext(
  groups: readonly Group[],
  getProfile: ProfileLookup,
): PhilosophyContext {
  const teams = groups.flatMap((group) => group.teams);
  const ratings = teams.map((team) => getProfile(team.id).modelRating);
  const fieldMeanRating =
    ratings.reduce((sum, value) => sum + value, 0) / (ratings.length || 1);

  const groupStrength = new Map<TeamId, number>();
  for (const group of groups) {
    for (const team of group.teams) {
      const opponents = group.teams.filter((other) => other.id !== team.id);
      const mean =
        opponents.reduce((sum, o) => sum + getProfile(o.id).modelRating, 0) /
        (opponents.length || 1);
      groupStrength.set(team.id, mean);
    }
  }

  const ratingRank = new Map<TeamId, number>(
    [...teams]
      .sort(
        (a, b) => getProfile(b.id).modelRating - getProfile(a.id).modelRating,
      )
      .map((team, index) => [team.id, index + 1]),
  );

  return { fieldMeanRating, groupStrength, ratingRank };
}

function buildGroupPicks(
  groups: readonly Group[],
  rating: (teamId: TeamId) => number,
): PickState {
  const picks: PickState = {};
  for (const group of groups) {
    for (const fixture of generateGroupFixtures(group)) {
      picks[fixture.id] = pickFromRatings(
        rating(fixture.homeId),
        rating(fixture.awayId),
      );
    }
  }
  return picks;
}

/** Deterministic pick: the model's most likely outcome plus a margin scoreline. */
function pickFromRatings(ratingA: number, ratingB: number): GroupPick {
  const probs = matchProbabilities(ratingA, ratingB);
  const outcome: MatchOutcome =
    probs.draw >= probs.home && probs.draw >= probs.away
      ? "DRAW"
      : probs.home >= probs.away
        ? "HOME"
        : "AWAY";
  return { outcome, scoreline: scorelineFor(outcome, ratingA - ratingB) };
}

function scorelineFor(outcome: MatchOutcome, ratingDelta: number): Scoreline {
  if (outcome === "DRAW") return { home: 1, away: 1 };
  const margin = Math.abs(ratingDelta) >= 200 ? 3 : 2;
  return outcome === "HOME"
    ? { home: margin, away: 1 }
    : { home: 1, away: margin };
}

function formSignal(text: string): number {
  let signal = 0;
  if (POSITIVE_FORM.test(text)) signal += 70;
  if (NEGATIVE_FORM.test(text)) signal -= 60;
  return signal;
}

function starSignal(keyPlayers: readonly string[]): number {
  const joined = keyPlayers.join(" ");
  const hits = STAR_NAMES.filter((name) => joined.includes(name)).length;
  return Math.min(hits, 3) * 70;
}

function pedigreeSignal(pedigree: string): number {
  if (CHAMPION_PEDIGREE.test(pedigree)) return 140;
  if (FINALIST_PEDIGREE.test(pedigree)) return 90;
  if (SEMI_PEDIGREE.test(pedigree)) return 60;
  if (QUARTER_PEDIGREE.test(pedigree)) return 35;
  if (DEBUT_PEDIGREE.test(pedigree)) return -60;
  return 0;
}

/** Heat acclimatisation for a hot North American summer, by home climate. */
function climateSignal(climate: HomeClimate): number {
  switch (climate) {
    case "hot":
      return 80;
    case "warm":
      return 30;
    case "temperate":
      return 0;
    case "cold":
      return -40;
  }
}

/** Travel/fatigue load from the host region (CONCACAF closest, OFC furthest). */
function travelSignal(confederation: Team["confederation"]): number {
  switch (confederation) {
    case "CONCACAF":
      return 30;
    case "CONMEBOL":
      return 10;
    case "OFC":
      return -25;
    default:
      return -10;
  }
}
