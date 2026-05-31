/**
 * Knockout bracket engine (build brief, §2 cascade, §3 progression).
 *
 * A single-elimination bracket is a perfect binary tree: 32 entrants → 16 R32
 * ties → 8 R16 → 4 QF → 2 SF → 1 Final. This module models that tree purely and
 * immutably. The user's winner picks are held as a flat `matchId → teamId` map;
 * the bracket the UI renders is always *derived* from the entrants plus that map
 * by {@link resolveBracket}.
 *
 * Deriving (rather than mutating) is what makes the cascade in §2 fall out for
 * free: when an earlier pick changes, a downstream pick that depended on the old
 * winner simply fails the "is this team still in this tie?" check during
 * re-derivation and is dropped — and that drop cascades onward — without ever
 * silently corrupting an unrelated part of the bracket.
 *
 * The 32 entrants are supplied in bracket order by the caller (see
 * {@link RoundId} ordering); wiring the group qualifiers and best thirds into
 * that order against FIFA's official slot map is a separate, data-only concern.
 */

import type { TeamId } from "@/domain/types";

/** Knockout rounds, largest first. */
export type RoundId = "R32" | "R16" | "QF" | "SF" | "F";

/** Rounds in order, paired with their match counts. */
export const ROUNDS: ReadonlyArray<{
  readonly id: RoundId;
  readonly size: number;
}> = [
  { id: "R32", size: 16 },
  { id: "R16", size: 8 },
  { id: "QF", size: 4 },
  { id: "SF", size: 2 },
  { id: "F", size: 1 },
];

/** Number of entrants the bracket expects. */
export const BRACKET_ENTRANTS = 32;

/** A resolved tie: its two (possibly not-yet-known) entrants and the pick. */
export interface BracketMatch {
  readonly id: string;
  readonly round: RoundId;
  readonly index: number;
  /** First entrant, once known (a seeded team or a previous winner). */
  readonly homeId: TeamId | undefined;
  /** Second entrant, once known. */
  readonly awayId: TeamId | undefined;
  /** The user's chosen winner, if set and still valid for this tie. */
  readonly winnerId: TeamId | undefined;
}

/** A fully derived bracket plus the cleaned (cascade-validated) pick map. */
export interface ResolvedBracket {
  readonly rounds: ReadonlyMap<RoundId, readonly BracketMatch[]>;
  readonly matches: readonly BracketMatch[];
  /** Picks that survived cascade validation (invalid/orphaned picks removed). */
  readonly winners: Readonly<Record<string, TeamId>>;
  /** The Final's winner, once chosen. */
  readonly championId: TeamId | undefined;
  /** How many ties have a valid winner pick. */
  readonly decided: number;
  /** Total ties in the bracket (always 31). */
  readonly total: number;
}

/** A flat map of match id → chosen winner team id. */
export type WinnerPicks = Readonly<Record<string, TeamId>>;

/** Build the stable id for a match. */
export function matchId(round: RoundId, index: number): string {
  return `${round}-${index}`;
}

/**
 * Derive the full bracket from its 32 ordered entrants and a winner-pick map.
 *
 * Picks are validated round by round: a pick counts only if the chosen team is
 * actually one of the two (resolved) entrants in that tie. Invalid picks — including
 * ones orphaned by an upstream change — are dropped, and because later rounds
 * read their entrants from earlier winners, that drop cascades automatically.
 *
 * @param entrants - 32 entrants in bracket order; `undefined` for unknown slots.
 * @param picks - raw winner picks (may contain now-invalid entries).
 * @returns the resolved bracket and the cleaned pick map.
 */
export function resolveBracket(
  entrants: ReadonlyArray<TeamId | undefined>,
  picks: WinnerPicks,
): ResolvedBracket {
  const rounds = new Map<RoundId, BracketMatch[]>();
  const cleanedWinners: Record<string, TeamId> = {};
  let previous: BracketMatch[] = [];

  for (const { id: round, size } of ROUNDS) {
    const matches: BracketMatch[] = [];
    for (let index = 0; index < size; index += 1) {
      const { homeId, awayId } = entrantsFor(round, index, entrants, previous);
      const id = matchId(round, index);
      const pick = picks[id];
      const winnerId = isValidPick(pick, homeId, awayId) ? pick : undefined;
      if (winnerId !== undefined) cleanedWinners[id] = winnerId;
      matches.push({ id, round, index, homeId, awayId, winnerId });
    }
    rounds.set(round, matches);
    previous = matches;
  }

  const allMatches = [...rounds.values()].flat();
  const final = rounds.get("F")?.[0];

  return {
    rounds,
    matches: allMatches,
    winners: cleanedWinners,
    championId: final?.winnerId,
    decided: allMatches.filter((match) => match.winnerId !== undefined).length,
    total: allMatches.length,
  };
}

/**
 * Set (or change) the winner of a tie, returning a freshly resolved bracket.
 * Any downstream picks invalidated by the change are cascaded away.
 */
export function pickWinner(
  entrants: ReadonlyArray<TeamId | undefined>,
  picks: WinnerPicks,
  id: string,
  winnerId: TeamId,
): ResolvedBracket {
  return resolveBracket(entrants, { ...picks, [id]: winnerId });
}

/** Clear a tie's winner (and anything downstream that depended on it). */
export function clearWinner(
  entrants: ReadonlyArray<TeamId | undefined>,
  picks: WinnerPicks,
  id: string,
): ResolvedBracket {
  const next = { ...picks };
  delete next[id];
  return resolveBracket(entrants, next);
}

/** The two entrants of a tie: seeded for R32, else winners of the feeder ties. */
function entrantsFor(
  round: RoundId,
  index: number,
  entrants: ReadonlyArray<TeamId | undefined>,
  previousRound: readonly BracketMatch[],
): { homeId: TeamId | undefined; awayId: TeamId | undefined } {
  if (round === "R32") {
    return { homeId: entrants[index * 2], awayId: entrants[index * 2 + 1] };
  }
  return {
    homeId: previousRound[index * 2]?.winnerId,
    awayId: previousRound[index * 2 + 1]?.winnerId,
  };
}

function isValidPick(
  pick: TeamId | undefined,
  homeId?: TeamId,
  awayId?: TeamId,
): pick is TeamId {
  return pick !== undefined && (pick === homeId || pick === awayId);
}
