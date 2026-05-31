import type { GroupId } from "@/domain/types";

import raw from "./annexCThirdPlaceAllocation.json";

export type ThirdPlaceSlot =
  | "1A"
  | "1B"
  | "1D"
  | "1E"
  | "1G"
  | "1I"
  | "1K"
  | "1L";

export type ThirdPlaceSlotAllocation = Readonly<
  Record<ThirdPlaceSlot, GroupId>
>;

export interface AnnexCAllocation {
  readonly option: number;
  readonly slots: ThirdPlaceSlotAllocation;
}

export interface AnnexCAllocationData {
  readonly schemaVersion: number;
  readonly source: string;
  readonly slots: readonly ThirdPlaceSlot[];
  readonly allocations: Readonly<Record<string, AnnexCAllocation>>;
}

export const annexCThirdPlaceAllocationData = raw as AnnexCAllocationData;

export const thirdPlaceSlots = annexCThirdPlaceAllocationData.slots;

export function allocationKey(groups: readonly GroupId[]): string {
  return [...groups].sort().join("");
}

export function getAnnexCAllocation(
  groups: readonly GroupId[],
): AnnexCAllocation {
  const unique = new Set(groups);
  if (groups.length !== 8 || unique.size !== 8) {
    throw new Error("Annexe C allocation requires eight unique group ids");
  }

  const key = allocationKey(groups);
  const allocation = annexCThirdPlaceAllocationData.allocations[key];
  if (!allocation) {
    throw new Error(`No Annexe C allocation for third-place groups: ${key}`);
  }
  return allocation;
}
