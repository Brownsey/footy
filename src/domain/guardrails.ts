/**
 * Knockout-pick guardrails (build brief, §8).
 *
 * Two non-blocking prompts can fire when the user advances a team in the
 * bracket. Both are advisory: they explain, then let the pick stand if confirmed.
 *
 *  1. **Low-probability warning** — the model rates the advanced team below
 *     {@link LOW_PROBABILITY_THRESHOLD} to win the tie. ("Are you sure?")
 *  2. **The "UK" easter egg** — a light-hearted nudge if Germany or France are
 *     picked to knock out England or Scotland. England (L) and Scotland (C) can
 *     only meet Germany (E) or France (I) in the knockouts, so this is, by
 *     construction, a knockout-only trigger.
 *
 * This module is pure: it takes a resolved tie plus the win probability and
 * returns the guardrails that apply, in priority order. Presentation and the
 * confirm/dismiss flow live in the UI.
 */

import type { TeamId } from "@/domain/types";

/** Modelled win probability below which a pick is flagged as a long shot. */
export const LOW_PROBABILITY_THRESHOLD = 0.15;

/** Teams that trigger the playful "UK" easter egg when they beat a UK side. */
const UK_NEMESES: ReadonlySet<TeamId> = new Set(["germany", "france"]);
/** The only two UK sides at the tournament (Wales and N. Ireland did not qualify). */
const UK_SIDES: ReadonlySet<TeamId> = new Set(["england", "scotland"]);

export type GuardrailKind = "low-probability" | "uk-easter-egg";

/** A single advisory prompt to surface before a pick is committed. */
export interface Guardrail {
  readonly kind: GuardrailKind;
  readonly title: string;
  readonly message: string;
}

/** The resolved tie and the model's read on the chosen team. */
export interface KnockoutPick {
  readonly chosenId: TeamId;
  readonly chosenName: string;
  readonly opponentId: TeamId;
  readonly opponentName: string;
  /** Model win probability for the chosen team, in `[0, 1]`. */
  readonly winProbability: number;
}

/**
 * Evaluate a knockout pick and return any guardrails that apply.
 *
 * @returns guardrails in priority order (low-probability first); empty when the
 *   pick is unremarkable and can be committed without a prompt.
 */
export function evaluateKnockoutPick(pick: KnockoutPick): Guardrail[] {
  const guardrails: Guardrail[] = [];

  if (pick.winProbability < LOW_PROBABILITY_THRESHOLD) {
    guardrails.push({
      kind: "low-probability",
      title: "Are you sure?",
      message: `The model gives ${pick.chosenName} only a ${formatPercent(
        pick.winProbability,
      )} chance against ${pick.opponentName}. Bold call — back it if you believe.`,
    });
  }

  if (UK_NEMESES.has(pick.chosenId) && UK_SIDES.has(pick.opponentId)) {
    guardrails.push({
      kind: "uk-easter-egg",
      title: "Are you crazy??",
      message: `${pick.chosenName} over ${pick.opponentName}? The UK is the best nation of them all! (Go on then, if you must.)`,
    });
  }

  return guardrails;
}

function formatPercent(probability: number): string {
  return `${Math.round(probability * 100)}%`;
}
