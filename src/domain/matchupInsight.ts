import type { TeamProfile } from "@/data/teamProfiles";
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

export interface MatchupInsight {
  readonly sideA: MatchupSide;
  readonly sideB: MatchupSide;
  readonly ratingDelta: number;
  readonly summary: string;
  readonly outcomes: Readonly<Record<MatchOutcome, OutcomeInsight>>;
  readonly options: readonly OutcomeInsight[];
}

const DRAW_BASE = 0.18;
const DRAW_CLOSE_MATCH_BONUS = 0.12;
const DRAW_MIN = 0.12;
const DRAW_MAX = 0.3;

export function getMatchupInsight(
  sideA: MatchupSide,
  sideB: MatchupSide,
): MatchupInsight {
  const ratingDelta = sideA.profile.modelRating - sideB.profile.modelRating;
  const expectedA = 1 / (1 + 10 ** (-ratingDelta / 400));
  const drawProbability = drawChance(ratingDelta);
  const decisiveProbability = 1 - drawProbability;
  const sideAProbability = decisiveProbability * expectedA;
  const sideBProbability = decisiveProbability * (1 - expectedA);

  const sideAName = sideA.team.name;
  const sideBName = sideB.team.name;
  const outcomes: Record<MatchOutcome, OutcomeInsight> = {
    HOME: {
      outcome: "HOME",
      label: `${sideAName} win`,
      probability: sideAProbability,
      reasons: winReasons(sideA, sideB, ratingDelta),
    },
    DRAW: {
      outcome: "DRAW",
      label: "Draw",
      probability: drawProbability,
      reasons: drawReasons(sideA, sideB, ratingDelta),
    },
    AWAY: {
      outcome: "AWAY",
      label: `${sideBName} win`,
      probability: sideBProbability,
      reasons: winReasons(sideB, sideA, -ratingDelta),
    },
  };

  return {
    sideA,
    sideB,
    ratingDelta,
    summary: summaryFor(sideA, sideB, ratingDelta),
    outcomes,
    options: [outcomes.HOME, outcomes.DRAW, outcomes.AWAY],
  };
}

export function probabilityPercent(probability: number): string {
  return `${Math.round(probability * 100)}%`;
}

function drawChance(ratingDelta: number): number {
  const closeness = 1 - Math.min(Math.abs(ratingDelta), 400) / 400;
  return clamp(
    DRAW_BASE + closeness * DRAW_CLOSE_MATCH_BONUS,
    DRAW_MIN,
    DRAW_MAX,
  );
}

function winReasons(
  candidate: MatchupSide,
  opponent: MatchupSide,
  ratingDelta: number,
): string[] {
  const reasons: string[] = [];

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

  return reasons;
}

function drawReasons(
  sideA: MatchupSide,
  sideB: MatchupSide,
  ratingDelta: number,
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

  reasons.push(
    "Neutral-site group fixtures reduce true home-field assumptions.",
  );

  const sideAStrength = sideA.profile.strengths.find((item) =>
    /defen|compact|structure|organisation/i.test(item),
  );
  const sideBStrength = sideB.profile.strengths.find((item) =>
    /defen|compact|structure|organisation/i.test(item),
  );
  if (sideAStrength || sideBStrength) {
    reasons.push(
      `Low-margin cue: ${sideAStrength ?? sideBStrength ?? "defensive shape"}.`,
    );
  }

  return reasons;
}

function summaryFor(
  sideA: MatchupSide,
  sideB: MatchupSide,
  ratingDelta: number,
): string {
  if (Math.abs(ratingDelta) < 25) {
    return `${sideA.team.name} and ${sideB.team.name} profile as a close neutral-site matchup.`;
  }
  const favorite = ratingDelta > 0 ? sideA : sideB;
  const underdog = ratingDelta > 0 ? sideB : sideA;
  return `${favorite.team.name} rate ahead of ${underdog.team.name}, mainly through ${favorite.profile.strengths[0]?.toLowerCase() ?? "the model baseline"}.`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
