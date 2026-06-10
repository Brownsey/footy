/**
 * The probability engine (build brief, §6).
 *
 * A single, deterministic, explainable model converts a rating gap between two
 * teams into outcome probabilities. Everything that needs a probability — match
 * insight, the "are you sure?" guardrail, the title-odds forecast and the
 * Claude Predicts sets — depends on this module, so the model lives in exactly
 * one place.
 *
 * The model is Elo-style: the expected (decisive) score for side A is the
 * logistic of the rating delta over {@link ELO_DIVISOR}. A separate, bounded
 * draw model carves a draw probability out of the decisive mass for fixtures
 * that can be drawn (group games); knockout ties cannot be drawn, so callers
 * use {@link winProbability} directly.
 */

import type { MatchOutcome, Scoreline } from "./types";

/** Rating points equivalent to a 10× change in expected-score odds. */
export const ELO_DIVISOR = 400;

/**
 * Elo-point boost for a side playing on home soil. The three 2026 hosts
 * (Mexico, USA, Canada) play every group game at home; this quantifies that
 * edge, in line with widely-used ~80-point home-advantage estimates.
 */
export const HOME_ADVANTAGE = 80;

const DRAW_BASE = 0.18;
const DRAW_CLOSE_MATCH_BONUS = 0.12;
const DRAW_MIN = 0.12;
const DRAW_MAX = 0.3;

/** A win/draw/loss split from the first team's perspective; always sums to 1. */
export interface OutcomeProbabilities {
  readonly home: number;
  readonly draw: number;
  readonly away: number;
}

/**
 * Logistic expected score for `ratingA` against `ratingB`, in `(0, 1)`.
 *
 * This is also the win probability in a knockout tie (no draws), so it doubles
 * as {@link winProbability}.
 */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / ELO_DIVISOR));
}

/** Win probability for `ratingA` over `ratingB` in a must-have-a-winner tie. */
export const winProbability = expectedScore;

/**
 * Draw probability for a fixture, rising as the rating gap narrows and clamped
 * to a sane band so no group game is ever a near-certain stalemate or a
 * draw-free formality.
 */
export function drawProbability(ratingDelta: number): number {
  const closeness =
    1 - Math.min(Math.abs(ratingDelta), ELO_DIVISOR) / ELO_DIVISOR;
  return clamp(
    DRAW_BASE + closeness * DRAW_CLOSE_MATCH_BONUS,
    DRAW_MIN,
    DRAW_MAX,
  );
}

/**
 * Full win/draw/loss probabilities for a drawable fixture (e.g. a group game),
 * splitting the decisive mass by Elo expected score.
 */
export function matchProbabilities(
  ratingA: number,
  ratingB: number,
): OutcomeProbabilities {
  const ratingDelta = ratingA - ratingB;
  const draw = drawProbability(ratingDelta);
  const decisive = 1 - draw;
  const expectedA = expectedScore(ratingA, ratingB);
  return {
    home: decisive * expectedA,
    draw,
    away: decisive * (1 - expectedA),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Goal-projection model (the single source of truth for expected goals and
 * scorelines). Average combined goals in a modern World Cup match is ~2.6 (the
 * last six tournaments sit in a 2.3–2.7 band); a ~220-point rating edge is worth
 * roughly one goal of supremacy. The average is split by the rating supremacy so
 * the favourite's projection rises and the underdog's falls, never below a small
 * floor. Deterministic and explainable.
 */
export const AVG_MATCH_GOALS = 2.6;
const ELO_PER_GOAL = 220;
const MIN_EXPECTED_GOALS = 0.25;
/** Goals enumerated per side when searching for the most likely scoreline. */
const MAX_GOALS = 7;

/** Continuous expected goals (Poisson means) for each side, home-perspective. */
export function projectedGoals(
  ratingA: number,
  ratingB: number,
): { readonly home: number; readonly away: number } {
  const supremacy = clamp((ratingA - ratingB) / ELO_PER_GOAL, -3, 3);
  return {
    home: Math.max(MIN_EXPECTED_GOALS, (AVG_MATCH_GOALS + supremacy) / 2),
    away: Math.max(MIN_EXPECTED_GOALS, (AVG_MATCH_GOALS - supremacy) / 2),
  };
}

function factorial(n: number): number {
  let result = 1;
  for (let i = 2; i <= n; i += 1) result *= i;
  return result;
}

/** Poisson probability mass of exactly `k` goals given mean `lambda`. */
function poissonPmf(k: number, lambda: number): number {
  return (Math.exp(-lambda) * lambda ** k) / factorial(k);
}

function matchesOutcome(home: number, away: number, outcome: MatchOutcome): boolean {
  if (outcome === "HOME") return home > away;
  if (outcome === "AWAY") return home < away;
  return home === away;
}

/**
 * The single most likely *exact* scoreline consistent with `outcome`, under two
 * independent Poisson distributions whose means come from {@link projectedGoals}.
 *
 * This replaces flat "winner 2–1" defaults: because 1–0 is the modal outcome of
 * a low-mean Poisson, modest favourites resolve to 1–0, clearer favourites to
 * 2–0/2–1 and mismatches to 3–0, mirroring the real World Cup scoreline
 * distribution (1–0 most common, then 2–1, 2–0, 1–1). Deterministic: ties in
 * probability are broken by enumeration order (fewer goals first).
 */
export function mostLikelyScoreline(
  ratingA: number,
  ratingB: number,
  outcome: MatchOutcome,
): Scoreline {
  const { home: lambdaHome, away: lambdaAway } = projectedGoals(ratingA, ratingB);
  let best: Scoreline | null = null;
  let bestProbability = -1;
  for (let home = 0; home < MAX_GOALS; home += 1) {
    for (let away = 0; away < MAX_GOALS; away += 1) {
      if (!matchesOutcome(home, away, outcome)) continue;
      const probability =
        poissonPmf(home, lambdaHome) * poissonPmf(away, lambdaAway);
      if (probability > bestProbability) {
        bestProbability = probability;
        best = { home, away };
      }
    }
  }
  // Every outcome has at least one matching scoreline within the range, but keep
  // a defensive fallback so the return type stays non-null.
  return best ?? (outcome === "AWAY" ? { home: 0, away: 1 } : { home: 1, away: 0 });
}
