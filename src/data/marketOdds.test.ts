import { describe, expect, it } from "vitest";

import {
  getMarketDecimal,
  impliedProbability,
  marketOddsData,
  oddsImpliedRating,
} from "./marketOdds";

describe("market odds", () => {
  it("stores positive decimal prices with the favourite shortest", () => {
    for (const entry of marketOddsData.odds) {
      expect(entry.decimal).toBeGreaterThan(1);
    }
    const spain = getMarketDecimal("spain")!;
    const croatia = getMarketDecimal("croatia")!;
    expect(spain).toBeLessThan(croatia);
  });

  it("covers the full 48-team field", () => {
    expect(marketOddsData.odds).toHaveLength(48);
  });

  it("returns undefined for an unknown team id", () => {
    expect(getMarketDecimal("atlantis")).toBeUndefined();
  });

  it("implied probability falls as the price lengthens", () => {
    expect(impliedProbability(getMarketDecimal("spain")!)).toBeGreaterThan(
      impliedProbability(getMarketDecimal("germany")!),
    );
  });

  it("maps prices back onto the model rating scale, monotonically", () => {
    const spain = oddsImpliedRating(getMarketDecimal("spain")!);
    const germany = oddsImpliedRating(getMarketDecimal("germany")!);
    const croatia = oddsImpliedRating(getMarketDecimal("croatia")!);
    expect(spain).toBeGreaterThan(germany);
    expect(germany).toBeGreaterThan(croatia);
    // Fitted to the calibrated tier: Spain ~1940, Germany ~1868.
    expect(spain).toBeGreaterThan(1900);
    expect(germany).toBeGreaterThan(1840);
    expect(germany).toBeLessThan(1900);
  });
});
