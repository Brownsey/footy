import { describe, expect, it } from "vitest";

import { forecastGroup } from "./groupForecast";
import type { Group, Team, TeamId } from "./types";

function team(id: string, pot: 1 | 2 | 3 | 4): Team {
  return { id, name: id, confederation: "UEFA", flag: "xx", pot };
}

const group: Group = {
  id: "A",
  teams: [team("a", 1), team("b", 2), team("c", 3), team("d", 4)],
};

const ratings: Record<TeamId, number> = {
  a: 1900,
  b: 1750,
  c: 1650,
  d: 1500,
};

const ratingOf = (id: TeamId): number => ratings[id] ?? 1500;

describe("forecastGroup", () => {
  it("returns a forecast for every team", () => {
    const forecast = forecastGroup(group, ratingOf);
    expect(forecast.map((f) => f.teamId).sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("keeps each finishing position a valid probability distribution", () => {
    const forecast = forecastGroup(group, ratingOf);
    const sum = (pick: (f: (typeof forecast)[number]) => number): number =>
      forecast.reduce((total, f) => total + pick(f), 0);

    expect(sum((f) => f.pWinGroup)).toBeCloseTo(1, 6);
    expect(sum((f) => f.pRunnerUp)).toBeCloseTo(1, 6);
    expect(sum((f) => f.pThird)).toBeCloseTo(1, 6);
    expect(sum((f) => f.pFourth)).toBeCloseTo(1, 6);
    // Two of four teams advance, so the advance mass totals 2.
    expect(sum((f) => f.pAdvanceTop2)).toBeCloseTo(2, 6);
  });

  it("each team's own four positions sum to one", () => {
    for (const f of forecastGroup(group, ratingOf)) {
      expect(f.pWinGroup + f.pRunnerUp + f.pThird + f.pFourth).toBeCloseTo(
        1,
        6,
      );
    }
  });

  it("makes the strongest team the most likely group winner", () => {
    const forecast = forecastGroup(group, ratingOf);
    const top = forecast[0]!;
    expect(top.teamId).toBe("a");
    expect(top.pWinGroup).toBe(Math.max(...forecast.map((f) => f.pWinGroup)));
    expect(top.pAdvanceTop2).toBeGreaterThan(0.5);
  });

  it("orders advancement and expected points by strength", () => {
    const forecast = forecastGroup(group, ratingOf);
    const byId = new Map(forecast.map((f) => [f.teamId, f]));
    expect(byId.get("a")!.pAdvanceTop2).toBeGreaterThan(
      byId.get("d")!.pAdvanceTop2,
    );
    expect(byId.get("a")!.expectedPoints).toBeGreaterThan(
      byId.get("d")!.expectedPoints,
    );
    expect(byId.get("a")!.expectedFinishRank).toBeLessThan(
      byId.get("d")!.expectedFinishRank,
    );
  });

  it("conserves rank mass — mean expected finishing position is 2.5", () => {
    // Four teams fill ranks 1–4 in every scenario, so the expected finishing
    // positions must always average to 2.5 regardless of the ratings.
    const meanRank =
      forecastGroup(group, ratingOf).reduce(
        (total, f) => total + f.expectedFinishRank,
        0,
      ) / group.teams.length;
    expect(meanRank).toBeCloseTo(2.5, 6);
  });

  it("keeps a group of near-equals tightly bunched around the toss-up line", () => {
    const level: Group = {
      id: "B",
      teams: [team("w", 1), team("x", 1), team("y", 1), team("z", 1)],
    };
    for (const f of forecastGroup(level, () => 1700)) {
      // With equal ratings only the deterministic tiebreak separates teams, so
      // every side sits close to the 50% advancement toss-up.
      expect(f.pAdvanceTop2).toBeGreaterThan(0.4);
      expect(f.pAdvanceTop2).toBeLessThan(0.6);
    }
  });
});
