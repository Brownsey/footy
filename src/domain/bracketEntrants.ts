/**
 * Wire group results into the 32 ordered Round-of-32 entrants (build brief, §3).
 *
 * The {@link bracket} engine is layout-agnostic — it just needs 32 entrants in
 * bracket order. This module produces that order from the completed group tables
 * and the best-thirds ranking.
 *
 * The pairing layout below is a **model** of FIFA's 2026 bracket that honours its
 * design principles — a group's winner and runner-up are kept in separate ties,
 * and the draw is split into two halves so the top seeds can only meet late — but
 * it is not claimed to be the exact official slot map. The official map is a
 * data-only swap: replace {@link R32_LAYOUT} and {@link THIRD_SLOT_FORBIDDEN}
 * with FIFA's published table and the engine is unchanged.
 *
 * The one piece of real FIFA logic that *is* enforced here: a third-placed team
 * may never be sent into a tie against a side from its own group. The eight
 * qualifying thirds are assigned to the eight third-slots by rank, respecting
 * that constraint via a deterministic backtracking search.
 */

import { rankThirdPlacedTeams, thirdPlacedOf } from "@/domain/thirdPlace";
import type { GroupSummary } from "@/domain/tournamentSummary";
import type { GroupId, TeamId } from "@/domain/types";

/** A position in a single R32 tie, to be resolved to a concrete team. */
export type SlotSpec =
  | { readonly kind: "winner"; readonly group: GroupId }
  | { readonly kind: "runnerUp"; readonly group: GroupId }
  | { readonly kind: "third"; readonly seed: number };

/**
 * The 32 entrants in bracket order. Consecutive pairs form the 16 R32 ties:
 * (0,1), (2,3), … Slots 0–15 are the top half, 16–31 the bottom half.
 */
export const R32_LAYOUT: readonly SlotSpec[] = [
  // Top half
  { kind: "winner", group: "A" },
  { kind: "runnerUp", group: "B" },
  { kind: "winner", group: "C" },
  { kind: "third", seed: 0 },
  { kind: "winner", group: "E" },
  { kind: "runnerUp", group: "F" },
  { kind: "winner", group: "G" },
  { kind: "third", seed: 1 },
  { kind: "winner", group: "I" },
  { kind: "runnerUp", group: "J" },
  { kind: "winner", group: "K" },
  { kind: "third", seed: 2 },
  { kind: "runnerUp", group: "D" },
  { kind: "third", seed: 3 },
  { kind: "runnerUp", group: "H" },
  { kind: "third", seed: 4 },
  // Bottom half
  { kind: "winner", group: "B" },
  { kind: "runnerUp", group: "A" },
  { kind: "winner", group: "D" },
  { kind: "third", seed: 5 },
  { kind: "winner", group: "F" },
  { kind: "runnerUp", group: "E" },
  { kind: "winner", group: "H" },
  { kind: "third", seed: 6 },
  { kind: "winner", group: "J" },
  { kind: "runnerUp", group: "I" },
  { kind: "winner", group: "L" },
  { kind: "third", seed: 7 },
  { kind: "runnerUp", group: "C" },
  { kind: "runnerUp", group: "K" },
  { kind: "runnerUp", group: "G" },
  { kind: "runnerUp", group: "L" },
];

/**
 * For each third-slot (by seed 0–7), the group whose team it is drawn against —
 * a third from that group must not be allocated here. Derived from the layout:
 * the third's tie partner.
 */
export const THIRD_SLOT_FORBIDDEN: Readonly<Record<number, GroupId>> = {
  0: "C", // vs winner C
  1: "G", // vs winner G
  2: "K", // vs winner K
  3: "D", // vs runner-up D
  4: "H", // vs runner-up H
  5: "D", // vs winner D
  6: "H", // vs winner H
  7: "L", // vs winner L
};

/** Number of third-slots in the bracket. */
export const THIRD_SLOTS = 8;

/**
 * Resolve the 32 R32 entrants from the group tables.
 *
 * @param summaries - the twelve group summaries (with computed tables).
 * @returns 32 entrants in bracket order; slots whose team is not yet known
 *   (incomplete groups, or thirds before all groups finish) are `undefined`.
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
 * Allocate the eight qualifying thirds to the eight third-slots, by rank and
 * never into a tie against their own group. Returns a seed→team map; empty until
 * all twelve groups are complete.
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

  const assignment = assignThirds(
    qualifiers.map((q) => ({ teamId: q.teamId, group: q.groupId })),
  );
  return assignment ?? slots;
}

interface QualifyingThird {
  readonly teamId: TeamId;
  readonly group: GroupId;
}

/**
 * Deterministic backtracking assignment of qualifiers (in rank order) to slots
 * 0…7, respecting {@link THIRD_SLOT_FORBIDDEN}. Returns `null` only if no valid
 * assignment exists (which the real allocation table is designed to prevent).
 */
function assignThirds(
  qualifiers: readonly QualifyingThird[],
): (TeamId | undefined)[] | null {
  const slots = new Array<TeamId | undefined>(THIRD_SLOTS).fill(undefined);
  const used = new Array<boolean>(qualifiers.length).fill(false);

  const place = (slot: number): boolean => {
    if (slot >= THIRD_SLOTS) return true;
    const forbidden = THIRD_SLOT_FORBIDDEN[slot];
    for (let i = 0; i < qualifiers.length; i += 1) {
      const candidate = qualifiers[i];
      if (used[i] || !candidate || candidate.group === forbidden) continue;
      slots[slot] = candidate.teamId;
      used[i] = true;
      if (place(slot + 1)) return true;
      slots[slot] = undefined;
      used[i] = false;
    }
    return false;
  };

  return place(0) ? slots : null;
}
