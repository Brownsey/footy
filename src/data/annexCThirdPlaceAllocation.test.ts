import { describe, expect, it } from "vitest";

import {
  annexCThirdPlaceAllocationData,
  getAnnexCAllocation,
  thirdPlaceSlots,
} from "./annexCThirdPlaceAllocation";

describe("Annexe C third-place allocation data", () => {
  it("contains all 495 official qualifying-group combinations", () => {
    expect(
      Object.keys(annexCThirdPlaceAllocationData.allocations),
    ).toHaveLength(495);
    expect(thirdPlaceSlots).toEqual([
      "1A",
      "1B",
      "1D",
      "1E",
      "1G",
      "1I",
      "1K",
      "1L",
    ]);
  });

  it("maps FIFA option 1 from Annexe C", () => {
    const allocation = getAnnexCAllocation([
      "E",
      "F",
      "G",
      "H",
      "I",
      "J",
      "K",
      "L",
    ]);

    expect(allocation.option).toBe(1);
    expect(allocation.slots).toEqual({
      "1A": "E",
      "1B": "J",
      "1D": "I",
      "1E": "F",
      "1G": "H",
      "1I": "G",
      "1K": "L",
      "1L": "K",
    });
  });

  it("maps FIFA option 495 from Annexe C", () => {
    const allocation = getAnnexCAllocation([
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
      "G",
      "H",
    ]);

    expect(allocation.option).toBe(495);
    expect(allocation.slots).toEqual({
      "1A": "H",
      "1B": "G",
      "1D": "B",
      "1E": "C",
      "1G": "A",
      "1I": "F",
      "1K": "D",
      "1L": "E",
    });
  });
});
