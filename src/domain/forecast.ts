/**
 * Title-odds forecast — "which team would win?" (build brief, §0, §6).
 *
 * Given each team's model rating, this computes the probability that each team
 * lifts the trophy. It is a fully deterministic, closed-form calculation (no
 * Monte-Carlo sampling): the field is seeded into a single-elimination bracket
 * and advancement probabilities are propagated round-by-round with exact
 * dynamic programming.
 *
 * Modelling note: until the official FIFA Round-of-32 slot map and best-third
 * allocation table are wired in, the bracket here is a neutral, strength-seeded
 * one (top seed vs lowest seed, etc.). It answers "given these ratings, who is
 * most likely to win a fair knockout?" rather than reproducing the exact 2026
 * draw geometry — a transparent proxy that the real bracket can later replace
 * without touching the propagation maths.
 */

import { winProbability } from "@/domain/probability";

/** One competitor's rating, the only input the forecast needs. */
export interface Contender {
  readonly teamId: string;
  readonly rating: number;
}

/** A team's modelled chance of winning the tournament. */
export interface TitleOdds {
  readonly teamId: string;
  readonly rating: number;
  /** Probability of winning the whole bracket, in `[0, 1]`. */
  readonly titleProbability: number;
  /** 1-based rank by title probability (1 = favourite). */
  readonly rank: number;
}

/** A bracket slot: a real contender, or a phantom that fills a bye. */
interface Slot {
  readonly rating: number;
  readonly index: number | null;
}

/** Rating for phantom slots; low enough that any real team beats them ~surely. */
const PHANTOM_RATING = -1e6;

/**
 * Forecast each contender's probability of winning a strength-seeded knockout.
 *
 * @param contenders - the teams and their ratings (any size ≥ 1).
 * @returns one {@link TitleOdds} per contender, sorted favourite-first. The
 *   probabilities sum to 1 (within floating-point tolerance).
 */
export function forecastTitleOdds(
  contenders: readonly Contender[],
): TitleOdds[] {
  if (contenders.length === 0) return [];

  const seeded = [...contenders].sort((a, b) => b.rating - a.rating);
  const slots = buildSeededBracket(seeded);
  const rounds = Math.log2(slots.length);

  // reach[p] = probability the team in slot p is still alive entering the round.
  let reach = slots.map(() => 1);

  for (let round = 1; round <= rounds; round += 1) {
    reach = slots.map((slot, p) => {
      const alive = reach[p] ?? 0;
      if (alive === 0) return 0;
      let advance = 0;
      for (const q of opponentsInRound(p, round)) {
        const opponentReach = reach[q] ?? 0;
        const opponent = slots[q];
        if (opponentReach === 0 || !opponent) continue;
        advance += opponentReach * winProbability(slot.rating, opponent.rating);
      }
      return alive * advance;
    });
  }

  const titles: TitleOdds[] = [];
  slots.forEach((slot, p) => {
    if (slot.index === null) return;
    const contender = seeded[slot.index];
    if (!contender) return;
    titles.push({
      teamId: contender.teamId,
      rating: contender.rating,
      titleProbability: reach[p] ?? 0,
      rank: 0,
    });
  });

  titles.sort((a, b) => b.titleProbability - a.titleProbability);
  return titles.map((odds, index) => ({ ...odds, rank: index + 1 }));
}

/**
 * Seed `n` contenders into a 2^k bracket using standard tournament seeding, so
 * seed 1 meets seed 2 only in the final, seeds 1 and 4 only in the semis, etc.
 * Surplus slots become phantom byes that the top seeds clear in round one.
 */
function buildSeededBracket(seeded: readonly Contender[]): Slot[] {
  const size = nextPowerOfTwo(seeded.length);
  const order = seedOrder(size);
  return order.map((seed) => {
    const contender = seeded[seed];
    return contender
      ? { index: seed, rating: contender.rating }
      : { index: null, rating: PHANTOM_RATING };
  });
}

/**
 * Standard seeding positions for a bracket of `size` (a power of two), returned
 * as the 0-based seed occupying each slot. Built by the classic recursive
 * mirror: [0,1] → [0,3,1,2] → [0,7,3,4,1,6,2,5] → …
 */
function seedOrder(size: number): number[] {
  let order = [0];
  while (order.length < size) {
    const rounds = order.length * 2;
    const mirrored: number[] = [];
    for (const seed of order) {
      mirrored.push(seed, rounds - 1 - seed);
    }
    order = mirrored;
  }
  return order;
}

/**
 * The slots that the team in slot `p` could face in `round` (1-based): the
 * opposite half of its round-`round` sub-bracket.
 */
function opponentsInRound(p: number, round: number): number[] {
  const blockSize = 1 << round;
  const halfBlock = 1 << (round - 1);
  const blockStart = Math.floor(p / blockSize) * blockSize;
  const inFirstHalf = p - blockStart < halfBlock;
  const oppStart = inFirstHalf ? blockStart + halfBlock : blockStart;
  const opponents: number[] = [];
  for (let i = oppStart; i < oppStart + halfBlock; i += 1) opponents.push(i);
  return opponents;
}

function nextPowerOfTwo(n: number): number {
  let size = 1;
  while (size < n) size *= 2;
  return size;
}
