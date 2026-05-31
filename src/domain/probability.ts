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

/** Rating points equivalent to a 10× change in expected-score odds. */
export const ELO_DIVISOR = 400;

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
