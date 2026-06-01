import type { TeamProfile } from "@/data/teamProfiles";
import {
  drawProbability,
  expectedScore,
  HOME_ADVANTAGE,
} from "@/domain/probability";
import type { Team, MatchOutcome } from "@/domain/types";

export interface MatchupSide {
  readonly team: Team;
  readonly profile: TeamProfile;
}

export interface OutcomeInsight {
  readonly outcome: MatchOutcome;
  readonly label: string;
  readonly probability: number;
  readonly reasons: readonly string[];
}

/** Which side a single head-to-head dimension favours. */
export type FactorEdge = "A" | "B" | "EVEN";

/** One comparable dimension between the two teams (ranking, form, pedigree, …). */
export interface InsightFactor {
  readonly label: string;
  readonly edge: FactorEdge;
  /** Human-readable head-to-head detail, e.g. "FIFA #1 vs #5". */
  readonly detail: string;
}

export interface MatchupInsight {
  readonly sideA: MatchupSide;
  readonly sideB: MatchupSide;
  /** Model rating gap, side A minus side B. */
  readonly ratingDelta: number;
  /** FIFA ranking gap, side B minus side A (positive = A ranked higher). */
  readonly rankingDelta: number;
  readonly summary: string;
  /** Head-to-head breakdown across the key analytical dimensions. */
  readonly keyFactors: readonly InsightFactor[];
  /**
   * Concrete tactical-clash notes computed from the two profiles: where one
   * side's strength meets the other's weakness (brief §5 "what to expect").
   */
  readonly whatToExpect: readonly string[];
  readonly outcomes: Readonly<Record<MatchOutcome, OutcomeInsight>>;
  readonly options: readonly OutcomeInsight[];
}

/** A thematic battleground: a strength on one side meeting a weakness on the other. */
interface ClashTheme {
  readonly strength: RegExp;
  readonly weakness: RegExp;
}

const CLASH_THEMES: readonly ClashTheme[] = [
  {
    strength: /pace|transition|counter|wide|explosive|direct|athletic/i,
    weakness: /pace|chase games|opened up|defensive lapses|transition defence|high line/i,
  },
  {
    strength: /set.?piece|aerial|dead ball|crosses/i,
    weakness: /set.?piece|aerial/i,
  },
  { strength: /press/i, weakness: /press/i },
  {
    strength: /creativ|chance creation|possession|playmak|technical|midfield control/i,
    weakness: /creative|chance creation|breaking down|cutting edge|midfield control/i,
  },
  {
    strength: /clinical|prolific|striker|talisman|attacking talent|attacking quality/i,
    weakness: /finishing|goal threat|centre-forward|over-rel|chance control/i,
  },
  {
    // Game control: a side that can sit on a result against one that cannot
    // chase a game or is forced out of its comfort zone.
    strength: /defen|resilien|organis|compact|control|composure|temperament|management|disciplin/i,
    weakness: /chase games|forced to (lead|attack|create)|struggle.*(lead|chase)|when forced|lead the play/i,
  },
  {
    // Experience: tournament know-how against a side short of it.
    strength: /experience|know-how|tournament|veteran|big-game/i,
    weakness: /experience gap|inexperien|tournament inexperience|step up|young as a unit/i,
  },
];

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
  "Kudus",
  "Mitoma",
  "Valverde",
  "Gyokeres",
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

/** Context that shifts a matchup away from a pure neutral-site read. */
export interface MatchupOptions {
  /** The side playing on home soil, if any (e.g. a host in its group games). */
  readonly hostSide?: "A" | "B";
}

export function getMatchupInsight(
  sideA: MatchupSide,
  sideB: MatchupSide,
  options: MatchupOptions = {},
): MatchupInsight {
  const baseA = sideA.profile.modelRating;
  const baseB = sideB.profile.modelRating;
  // Quality gap (venue-independent), used for the head-to-head comparisons.
  const ratingDelta = baseA - baseB;
  // Effective ratings fold in home advantage and drive the probabilities.
  const effectiveA = baseA + (options.hostSide === "A" ? HOME_ADVANTAGE : 0);
  const effectiveB = baseB + (options.hostSide === "B" ? HOME_ADVANTAGE : 0);
  const effectiveDelta = effectiveA - effectiveB;
  const rankingDelta = sideB.profile.fifaRanking - sideA.profile.fifaRanking;
  const expectedA = expectedScore(effectiveA, effectiveB);
  const drawProb = drawProbability(effectiveDelta);
  const decisiveProbability = 1 - drawProb;
  const sideAProbability = decisiveProbability * expectedA;
  const sideBProbability = decisiveProbability * (1 - expectedA);

  const sideAName = sideA.team.name;
  const sideBName = sideB.team.name;
  const outcomes: Record<MatchOutcome, OutcomeInsight> = {
    HOME: {
      outcome: "HOME",
      label: `${sideAName} win`,
      probability: sideAProbability,
      reasons: winReasons(sideA, sideB, ratingDelta, options.hostSide === "A"),
    },
    DRAW: {
      outcome: "DRAW",
      label: "Draw",
      probability: drawProb,
      reasons: drawReasons(sideA, sideB, ratingDelta, options.hostSide),
    },
    AWAY: {
      outcome: "AWAY",
      label: `${sideBName} win`,
      probability: sideBProbability,
      reasons: winReasons(sideB, sideA, -ratingDelta, options.hostSide === "B"),
    },
  };

  return {
    sideA,
    sideB,
    ratingDelta,
    rankingDelta,
    summary: summaryFor(sideA, sideB, ratingDelta, options.hostSide),
    keyFactors: keyFactorsFor(sideA, sideB, options.hostSide),
    whatToExpect: whatToExpect(sideA, sideB, ratingDelta),
    outcomes,
    options: [outcomes.HOME, outcomes.DRAW, outcomes.AWAY],
  };
}

export function probabilityPercent(probability: number): string {
  return `${Math.round(probability * 100)}%`;
}

/**
 * A head-to-head read across the dimensions a viewer actually compares: model
 * rating, FIFA ranking, recent form, World Cup pedigree, star power and
 * defensive solidity. Each is resolved to the side it favours so the UI can
 * show *why* a tie leans the way it does, not just a single probability.
 */
function keyFactorsFor(
  sideA: MatchupSide,
  sideB: MatchupSide,
  hostSide?: "A" | "B",
): InsightFactor[] {
  const a = sideA.profile;
  const b = sideB.profile;

  const factors: InsightFactor[] = [
    {
      label: "Model rating",
      edge: edgeFromDelta(a.modelRating - b.modelRating, 15),
      detail: `${a.modelRating} vs ${b.modelRating}`,
    },
    {
      label: "FIFA ranking",
      // Lower ranking number is better, so the edge flips.
      edge: edgeFromDelta(b.fifaRanking - a.fifaRanking, 0),
      detail: `#${a.fifaRanking} vs #${b.fifaRanking}`,
    },
    {
      label: "Form",
      edge: edgeFromDelta(formScore(a) - formScore(b), 0),
      detail: `${formWord(a)} vs ${formWord(b)}`,
    },
    {
      label: "Pedigree",
      edge: edgeFromDelta(pedigreeScore(a) - pedigreeScore(b), 0),
      detail: `${pedigreeWord(a)} vs ${pedigreeWord(b)}`,
    },
    {
      label: "Star power",
      edge: edgeFromDelta(starCount(a) - starCount(b), 0),
      detail: `${starCount(a)} vs ${starCount(b)} marquee names`,
    },
    {
      label: "Defensive solidity",
      edge: edgeFromDelta(defensiveScore(a) - defensiveScore(b), 0),
      detail: defensiveDetail(a, b),
    },
  ];

  if (hostSide) {
    const host = hostSide === "A" ? sideA : sideB;
    factors.push({
      label: "Venue",
      edge: hostSide,
      detail: `${host.team.name} at home`,
    });
  }

  return factors;
}

function edgeFromDelta(delta: number, deadZone: number): FactorEdge {
  if (delta > deadZone) return "A";
  if (delta < -deadZone) return "B";
  return "EVEN";
}

/**
 * "What to expect" notes synthesised from the two profiles (brief §5): for each
 * thematic battleground (pace, set pieces, the press, creativity, finishing),
 * surface where one side's stated strength meets the other's stated weakness.
 * At most one note per direction — the most salient clash — so the panel stays
 * concrete rather than listing every theme.
 */
function whatToExpect(
  sideA: MatchupSide,
  sideB: MatchupSide,
  ratingDelta: number,
): string[] {
  const notes: string[] = [];
  for (const [attacker, defender] of [
    [sideA, sideB],
    [sideB, sideA],
  ] as const) {
    for (const theme of CLASH_THEMES) {
      const strength = attacker.profile.strengths.find((item) =>
        theme.strength.test(item),
      );
      const weakness = defender.profile.weaknesses.find((item) =>
        theme.weakness.test(item),
      );
      if (strength && weakness) {
        notes.push(
          `${attacker.team.name}'s ${lowerFirst(strength)} should test ${defender.team.name} (${lowerFirst(weakness)}).`,
        );
        break;
      }
    }
  }

  if (notes.length === 0) {
    notes.push(genericExpectation(sideA, sideB, ratingDelta));
  }
  return notes;
}

function genericExpectation(
  sideA: MatchupSide,
  sideB: MatchupSide,
  ratingDelta: number,
): string {
  if (Math.abs(ratingDelta) < 25) {
    return `Finely balanced — expect ${sideA.team.name} and ${sideB.team.name} to trade control with little between them.`;
  }
  const favorite = ratingDelta > 0 ? sideA : sideB;
  const underdog = ratingDelta > 0 ? sideB : sideA;
  return `Expect ${favorite.team.name} to carry the play; ${underdog.team.name}'s route is to stay compact and strike on the break.`;
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function winReasons(
  candidate: MatchupSide,
  opponent: MatchupSide,
  ratingDelta: number,
  isHost = false,
): string[] {
  const reasons: string[] = [];

  if (isHost) {
    reasons.push(
      `${candidate.team.name} play every group game on home soil — a real crowd and travel edge.`,
    );
  }

  if (ratingDelta >= 90) {
    reasons.push(
      `${candidate.team.name} carry a ${ratingDelta}-point model edge.`,
    );
  } else if (ratingDelta >= 25) {
    reasons.push(`${candidate.team.name} have the stronger model baseline.`);
  } else if (ratingDelta > -25) {
    reasons.push("The model sees this as close enough for a narrow win path.");
  } else {
    reasons.push(
      `This is an upset path against a ${Math.abs(ratingDelta)}-point rating gap.`,
    );
  }

  const strength = candidate.profile.strengths[0];
  if (strength) reasons.push(`${candidate.team.name}: ${strength}.`);

  const weakness = opponent.profile.weaknesses[0];
  if (weakness) reasons.push(`Can target ${opponent.team.name}: ${weakness}.`);

  // Surface the most decisive edge from the head-to-head dimensions, so the
  // win case reflects *why* beyond the raw rating gap.
  const formEdge = formScore(candidate.profile) - formScore(opponent.profile);
  if (formEdge > 0) {
    reasons.push(
      `Momentum favours ${candidate.team.name} (${formWord(candidate.profile).toLowerCase()} into the finals).`,
    );
  }

  const stars = starCount(candidate.profile);
  if (stars >= 2 && stars > starCount(opponent.profile)) {
    reasons.push(
      `Match-winners on the pitch: ${markeeNames(candidate.profile).join(", ")}.`,
    );
  }

  return reasons;
}

function drawReasons(
  sideA: MatchupSide,
  sideB: MatchupSide,
  ratingDelta: number,
  hostSide?: "A" | "B",
): string[] {
  const gap = Math.abs(ratingDelta);
  const reasons: string[] = [];

  if (gap <= 40) {
    reasons.push("Ratings are close, so shared points are a live outcome.");
  } else if (gap <= 120) {
    reasons.push(
      "The favorite has an edge, but not enough to rule out a draw.",
    );
  } else {
    reasons.push(
      "The draw needs the underdog to slow the match and reduce chances.",
    );
  }

  if (hostSide) {
    const host = hostSide === "A" ? sideA : sideB;
    reasons.push(
      `${host.team.name}'s home advantage tilts this, but a draw still shares the spoils.`,
    );
  } else {
    reasons.push(
      "Neutral-site group fixtures reduce true home-field assumptions.",
    );
  }

  // If both sides defend well, a low-event stalemate is more credible.
  if (defensiveScore(sideA.profile) > 0 && defensiveScore(sideB.profile) > 0) {
    reasons.push(
      "Both sides defend well, pointing to a low-event, tight contest.",
    );
  } else {
    const compact = [sideA, sideB].find(
      (side) => defensiveScore(side.profile) > 0,
    );
    if (compact) {
      reasons.push(
        `Low-margin cue: ${compact.profile.strengths.find((item) => DEFENSIVE.test(item)) ?? "defensive shape"}.`,
      );
    }
  }

  return reasons;
}

function summaryFor(
  sideA: MatchupSide,
  sideB: MatchupSide,
  ratingDelta: number,
  hostSide?: "A" | "B",
): string {
  if (hostSide) {
    const host = hostSide === "A" ? sideA : sideB;
    const visitor = hostSide === "A" ? sideB : sideA;
    return `${host.team.name} carry home advantage against ${visitor.team.name}, lifting an otherwise ${Math.abs(ratingDelta) < 25 ? "even" : "rating-led"} tie.`;
  }
  if (Math.abs(ratingDelta) < 25) {
    return `${sideA.team.name} and ${sideB.team.name} profile as a close neutral-site matchup.`;
  }
  const favorite = ratingDelta > 0 ? sideA : sideB;
  const underdog = ratingDelta > 0 ? sideB : sideA;
  const rankingGap = Math.abs(
    favorite.profile.fifaRanking - underdog.profile.fifaRanking,
  );
  const edge =
    favorite.profile.strengths[0]?.toLowerCase() ?? "the model baseline";
  const rankNote =
    rankingGap >= 20
      ? ` and a ${rankingGap}-place FIFA ranking gap`
      : "";
  return `${favorite.team.name} rate ahead of ${underdog.team.name}, mainly through ${edge}${rankNote}.`;
}

function formScore(profile: TeamProfile): number {
  const text = `${profile.recentForm} ${profile.narrative}`;
  let score = 0;
  if (POSITIVE_FORM.test(text)) score += 1;
  if (NEGATIVE_FORM.test(text)) score -= 1;
  return score;
}

function formWord(profile: TeamProfile): string {
  const score = formScore(profile);
  if (score > 0) return "Hot";
  if (score < 0) return "Patchy";
  return "Steady";
}

function pedigreeScore(profile: TeamProfile): number {
  const text = profile.worldCupPedigree;
  if (CHAMPION_PEDIGREE.test(text)) return 4;
  if (FINALIST_PEDIGREE.test(text)) return 3;
  if (SEMI_PEDIGREE.test(text)) return 2;
  if (QUARTER_PEDIGREE.test(text)) return 1;
  return 0;
}

function pedigreeWord(profile: TeamProfile): string {
  switch (pedigreeScore(profile)) {
    case 4:
      return "Past winner";
    case 3:
      return "Finalist";
    case 2:
      return "Semi-finalist";
    case 1:
      return "Quarter-finalist";
    default:
      return "Outsider";
  }
}

function markeeNames(profile: TeamProfile): string[] {
  return profile.keyPlayers.filter((player) =>
    STAR_NAMES.some((name) => player.includes(name)),
  );
}

function starCount(profile: TeamProfile): number {
  return markeeNames(profile).length;
}

function defensiveScore(profile: TeamProfile): number {
  const strong = profile.strengths.some((item) => DEFENSIVE.test(item)) ? 1 : 0;
  const leaky = profile.weaknesses.some((item) => DEFENSIVE.test(item)) ? 1 : 0;
  return strong - leaky;
}

function defensiveDetail(a: TeamProfile, b: TeamProfile): string {
  const word = (score: number): string =>
    score > 0 ? "Solid" : score < 0 ? "Leaky" : "Balanced";
  return `${word(defensiveScore(a))} vs ${word(defensiveScore(b))}`;
}
