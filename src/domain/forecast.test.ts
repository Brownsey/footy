import { describe, expect, it } from "vitest";

import { forecastTitleOdds, type Contender } from "./forecast";

function field(ratings: readonly number[]): Contender[] {
  return ratings.map((rating, index) => ({ teamId: `t${index}`, rating }));
}

describe("forecastTitleOdds", () => {
  it("returns nothing for an empty field", () => {
    expect(forecastTitleOdds([])).toEqual([]);
  });

  it("gives a lone team certainty", () => {
    const odds = forecastTitleOdds(field([1800]));
    expect(odds).toHaveLength(1);
    expect(odds[0]!.titleProbability).toBeCloseTo(1, 10);
  });

  it("normalises title probabilities to one", () => {
    const odds = forecastTitleOdds(field([1900, 1850, 1800, 1750, 1700, 1500]));
    const total = odds.reduce((sum, o) => sum + o.titleProbability, 0);
    expect(total).toBeCloseTo(1, 6);
  });

  it("ranks the strongest team as favourite", () => {
    const odds = forecastTitleOdds(field([1700, 1950, 1800, 1600]));
    expect(odds[0]!.rating).toBe(1950);
    expect(odds[0]!.rank).toBe(1);
    expect(odds[0]!.titleProbability).toBe(
      Math.max(...odds.map((o) => o.titleProbability)),
    );
  });

  it("is monotonic — higher rating never means lower title odds", () => {
    const odds = forecastTitleOdds(field([2000, 1900, 1800, 1700]));
    const byRating = [...odds].sort((a, b) => b.rating - a.rating);
    for (let i = 1; i < byRating.length; i += 1) {
      expect(byRating[i - 1]!.titleProbability).toBeGreaterThanOrEqual(
        byRating[i]!.titleProbability,
      );
    }
  });

  it("splits a power-of-two field of equals uniformly", () => {
    const odds = forecastTitleOdds(field([1800, 1800, 1800, 1800]));
    for (const o of odds) expect(o.titleProbability).toBeCloseTo(0.25, 10);
  });

  it("handles a non-power-of-two field with byes and still sums to one", () => {
    const odds = forecastTitleOdds(
      field([1900, 1850, 1820, 1790, 1760, 1700, 1650, 1600, 1550, 1500, 1450]),
    );
    expect(odds).toHaveLength(11);
    const total = odds.reduce((sum, o) => sum + o.titleProbability, 0);
    expect(total).toBeCloseTo(1, 6);
    expect(odds[0]!.rating).toBe(1900);
  });

  it("scales to the full 48-team field", () => {
    const ratings = Array.from({ length: 48 }, (_, i) => 1500 + i * 10);
    const odds = forecastTitleOdds(field(ratings));
    expect(odds).toHaveLength(48);
    const total = odds.reduce((sum, o) => sum + o.titleProbability, 0);
    expect(total).toBeCloseTo(1, 6);
    expect(odds[0]!.rating).toBe(1500 + 47 * 10);
  });
});
