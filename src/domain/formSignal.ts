/**
 * Graded recent-form scorer, shared by the matchup insight (the "Form" factor)
 * and the "Form over reputation" prediction philosophy so both read momentum
 * the same way.
 *
 * Rather than a binary hot/cold flag, prose is graded on a small scale: a
 * strong signal (e.g. "unbeaten", "demolished") counts double a mild one
 * (e.g. "won", "comfortable"), and the two directions net off. The result is
 * bounded to [-2, 2].
 */

const STRONG_POSITIVE =
  /\b(perfect|unbeaten|flawless|dominant|dominated|demolished|stormed|storming|flying|resurgent)\b/i;
const MILD_POSITIVE =
  /\b(won|win|topped?|comfortab|cruised|surged|strong|steadied)\b/i;
const STRONG_NEGATIVE = /\b(poor|wobbl|stuttered?)\b/i;
const MILD_NEGATIVE =
  /\b(mixed|uneven|streaky|edged|survived|playoff|pragmatic|cautious)\b/i;

/** Graded recent-form signal in `[-2, 2]` from a profile's form/narrative prose. */
export function gradeForm(text: string): number {
  let score = 0;
  if (STRONG_POSITIVE.test(text)) score += 2;
  else if (MILD_POSITIVE.test(text)) score += 1;
  if (STRONG_NEGATIVE.test(text)) score -= 2;
  else if (MILD_NEGATIVE.test(text)) score -= 1;
  return score;
}
