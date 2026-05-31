/**
 * Best third-placed teams — the part of the 2026 format most easily got wrong.
 *
 * Twelve groups each produce a third-placed team; the **eight best** of those
 * twelve advance to the Round of 32 (see the build brief, §1). This module
 * ranks the twelve thirds and selects the qualifying eight. Mapping each
 * qualifier into a specific R32 slot is a separate concern handled by the
 * bracket module against FIFA's fixed allocation table.
 *
 * Ranking criteria (FIFA order): points → goal difference → goals scored →
 * (disciplinary record → drawing of lots). The last two are not derivable from
 * predicted scorelines, so we fall back to a deterministic group-letter
 * ordering and surface it as {@link ThirdPlaceRanking.tiebreakNeeded} so the UI
 * can prompt the user when it actually affects who qualifies.
 */

import type { GroupId, StandingRow, TeamId } from "./types";

/** A third-placed team carried forward for cross-group comparison. */
export interface ThirdPlaceCandidate {
  readonly groupId: GroupId;
  readonly row: StandingRow;
}

/** A ranked third-placed team. */
export interface RankedThird {
  readonly groupId: GroupId;
  readonly teamId: TeamId;
  readonly points: number;
  readonly goalDifference: number;
  readonly goalsFor: number;
  /** 1-based position across all twelve third-placed teams. */
  readonly rank: number;
  /** True once this team is inside the qualifying cut. */
  readonly qualified: boolean;
}

export interface ThirdPlaceRanking {
  readonly ranked: readonly RankedThird[];
  /** The qualifying teams (the first {@link QUALIFYING_THIRDS}). */
  readonly qualifiers: readonly RankedThird[];
  /**
   * True when teams straddling the qualifying cut are tied on every derivable
   * criterion, so the real outcome would need a FIFA tiebreaker the model
   * cannot compute.
   */
  readonly tiebreakNeeded: boolean;
}

/** Eight of the twelve third-placed teams advance. */
export const QUALIFYING_THIRDS = 8;

/** Extract the third-placed row from a completed group table. */
export function thirdPlacedOf(
  groupId: GroupId,
  table: readonly StandingRow[],
): ThirdPlaceCandidate {
  const row = table.find((r) => r.rank === 3);
  if (!row) {
    throw new Error(`Group ${groupId} has no third-placed team`);
  }
  return { groupId, row };
}

/**
 * Rank the twelve third-placed teams and mark the qualifying eight.
 *
 * @param candidates - the third-placed team from each group (expects twelve,
 *   but works for any number — useful for partial/in-progress states).
 * @returns the full ranking plus the qualifiers and a tiebreak flag.
 */
export function rankThirdPlacedTeams(
  candidates: readonly ThirdPlaceCandidate[],
): ThirdPlaceRanking {
  const sorted = [...candidates].sort(compareCandidates);

  const ranked: RankedThird[] = sorted.map((candidate, index) => ({
    groupId: candidate.groupId,
    teamId: candidate.row.teamId,
    points: candidate.row.points,
    goalDifference: candidate.row.goalDifference,
    goalsFor: candidate.row.goalsFor,
    rank: index + 1,
    qualified: index < QUALIFYING_THIRDS,
  }));

  return {
    ranked,
    qualifiers: ranked.filter((team) => team.qualified),
    tiebreakNeeded: hasTieAcrossCut(sorted),
  };
}

/**
 * Sort comparator: better team first.
 *
 * The final group-letter tiebreak stands in for FIFA's disciplinary record and
 * drawing of lots, keeping the ordering fully deterministic.
 */
function compareCandidates(
  a: ThirdPlaceCandidate,
  b: ThirdPlaceCandidate,
): number {
  if (b.row.points !== a.row.points) return b.row.points - a.row.points;
  if (b.row.goalDifference !== a.row.goalDifference) {
    return b.row.goalDifference - a.row.goalDifference;
  }
  if (b.row.goalsFor !== a.row.goalsFor) {
    return b.row.goalsFor - a.row.goalsFor;
  }
  return a.groupId.localeCompare(b.groupId);
}

/** Two thirds are tied if equal on every model-derivable criterion. */
function isDerivableTie(
  a: ThirdPlaceCandidate,
  b: ThirdPlaceCandidate,
): boolean {
  return (
    a.row.points === b.row.points &&
    a.row.goalDifference === b.row.goalDifference &&
    a.row.goalsFor === b.row.goalsFor
  );
}

/**
 * True when the teams on either side of the qualifying cut are a derivable tie,
 * i.e. the eighth and ninth teams are level and only a FIFA tiebreaker would
 * decide who actually advances.
 */
function hasTieAcrossCut(sorted: readonly ThirdPlaceCandidate[]): boolean {
  const last = sorted[QUALIFYING_THIRDS - 1];
  const next = sorted[QUALIFYING_THIRDS];
  if (!last || !next) return false;
  return isDerivableTie(last, next);
}
