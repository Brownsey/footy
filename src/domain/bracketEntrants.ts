/**
 * Wire completed group tables into FIFA's official Round-of-32 slots.
 *
 * `R32_LAYOUT` is ordered by official match number M73-M88. Consecutive pairs
 * form the visible Round of 32 ties consumed by the bracket engine. The eight
 * third-placed entrants are resolved through FIFA World Cup 26 Regulations
 * Annexe C.
 */

import {
  resolveThirdPlaceRoundOf32Allocation,
  type OfficialMatchId,
} from "@/domain/bracket";
import { rankThirdPlacedTeams, thirdPlacedOf } from "@/domain/thirdPlace";
import type { GroupSummary } from "@/domain/tournamentSummary";
import type { GroupId, TeamId } from "@/domain/types";
import type { ThirdPlaceSlot } from "@/data/annexCThirdPlaceAllocation";

/** A position in a single R32 tie, to be resolved to a concrete team. */
export type SlotSpec =
  | { readonly kind: "winner"; readonly group: GroupId }
  | { readonly kind: "runnerUp"; readonly group: GroupId }
  | { readonly kind: "third"; readonly seed: number };

/**
 * The 32 entrants in official M73-M88 order:
 * M73=(0,1), M74=(2,3), ... M88=(30,31).
 */
export const R32_LAYOUT: readonly SlotSpec[] = [
  { kind: "runnerUp", group: "A" },
  { kind: "runnerUp", group: "B" },
  { kind: "winner", group: "E" },
  { kind: "third", seed: 0 },
  { kind: "winner", group: "F" },
  { kind: "runnerUp", group: "C" },
  { kind: "winner", group: "C" },
  { kind: "runnerUp", group: "F" },
  { kind: "winner", group: "I" },
  { kind: "third", seed: 1 },
  { kind: "runnerUp", group: "E" },
  { kind: "runnerUp", group: "I" },
  { kind: "winner", group: "A" },
  { kind: "third", seed: 2 },
  { kind: "winner", group: "L" },
  { kind: "third", seed: 3 },
  { kind: "winner", group: "D" },
  { kind: "third", seed: 4 },
  { kind: "winner", group: "G" },
  { kind: "third", seed: 5 },
  { kind: "runnerUp", group: "K" },
  { kind: "runnerUp", group: "L" },
  { kind: "winner", group: "H" },
  { kind: "runnerUp", group: "J" },
  { kind: "winner", group: "B" },
  { kind: "third", seed: 6 },
  { kind: "winner", group: "J" },
  { kind: "runnerUp", group: "H" },
  { kind: "winner", group: "K" },
  { kind: "third", seed: 7 },
  { kind: "runnerUp", group: "D" },
  { kind: "runnerUp", group: "G" },
];

/** The official third-place slot represented by each local third seed. */
export const THIRD_SLOT_BY_SEED: readonly ThirdPlaceSlot[] = [
  "1E",
  "1I",
  "1A",
  "1L",
  "1D",
  "1G",
  "1B",
  "1K",
];

/**
 * For each third-slot seed, the group winner it faces. This remains useful for
 * tests and sanity checks even though Annexe C now performs the allocation.
 */
export const THIRD_SLOT_FORBIDDEN: Readonly<Record<number, GroupId>> = {
  0: "E",
  1: "I",
  2: "A",
  3: "L",
  4: "D",
  5: "G",
  6: "B",
  7: "K",
};

/** Number of third-slots in the bracket. */
export const THIRD_SLOTS = 8;

const THIRD_SEED_BY_MATCH: Partial<Record<OfficialMatchId, number>> = {
  M74: 0,
  M77: 1,
  M79: 2,
  M80: 3,
  M81: 4,
  M82: 5,
  M85: 6,
  M87: 7,
};

/**
 * Resolve the 32 R32 entrants from the group tables.
 *
 * @param summaries - the twelve group summaries (with computed tables).
 * @returns 32 entrants in official R32 order; slots whose team is not yet known
 *   are `undefined`.
 */
export function buildEntrants(
  summaries: readonly GroupSummary[],
): (TeamId | undefined)[] {
  const byGroup = new Map<GroupId, GroupSummary>(
    summaries.map((summary) => [summary.group.id, summary]),
  );

  const thirdSeedToTeam = resolveThirdSlots(summaries);

  return R32_LAYOUT.map((spec) => {
    if (spec.kind === "third") return thirdSeedToTeam[spec.seed];
    const summary = byGroup.get(spec.group);
    if (!summary?.complete) return undefined;
    const wantedRank = spec.kind === "winner" ? 1 : 2;
    return summary.table.find((row) => row.rank === wantedRank)?.teamId;
  });
}

/**
 * Allocate the eight qualifying thirds to FIFA's eight R32 third-place slots.
 * Returns an empty map until all groups are complete.
 */
function resolveThirdSlots(
  summaries: readonly GroupSummary[],
): (TeamId | undefined)[] {
  const slots = new Array<TeamId | undefined>(THIRD_SLOTS).fill(undefined);
  if (!summaries.every((summary) => summary.complete)) return slots;

  const thirds = summaries.map((summary) =>
    thirdPlacedOf(summary.group.id, summary.table),
  );
  const qualifiers = rankThirdPlacedTeams(thirds).qualifiers;
  const allocation = resolveThirdPlaceRoundOf32Allocation(qualifiers);

  for (const assignment of allocation.assignments) {
    const seed = THIRD_SEED_BY_MATCH[assignment.matchId];
    if (seed !== undefined) slots[seed] = assignment.teamId;
  }

  return slots;
}
