import { describe, expect, it } from "vitest";

import type { ScorerCandidate } from "@/data/topScorers";

import {
  expectedGamesByTeam,
  forecastGoldenBoot,
  type TeamReach,
} from "./goldenBoot";

function reach(teamId: string, deep: boolean): TeamReach {
  const p = deep ? 0.8 : 0.2;
  return {
    teamId,
    pQualify: deep ? 0.95 : 0.5,
    pReachR16: p,
    pReachQuarter: p * 0.7,
    pReachSemi: p * 0.5,
    pReachFinal: p * 0.3,
  };
}

describe("expectedGamesByTeam", () => {
  it("gives deep-running teams more expected games, never fewer than three", () => {
    const games = expectedGamesByTeam([reach("deep", true), reach("shallow", false)]);
    expect(games.get("deep")!).toBeGreaterThan(games.get("shallow")!);
    expect(games.get("shallow")!).toBeGreaterThanOrEqual(3);
  });
});

describe("forecastGoldenBoot", () => {
  const candidates: ScorerCandidate[] = [
    { name: "Sharp on a deep team", teamId: "deep", goalsPerGame: 0.6, marketDecimal: 7 },
    { name: "Sharp on a weak team", teamId: "shallow", goalsPerGame: 0.6, marketDecimal: 7 },
    { name: "Steady on a deep team", teamId: "deep", goalsPerGame: 0.4, marketDecimal: 20 },
  ];
  const games = expectedGamesByTeam([reach("deep", true), reach("shallow", false)]);

  it("multiplies rate by expected games and ranks favourite-first by win odds", () => {
    const boot = forecastGoldenBoot(candidates, games);
    expect(boot[0]!.rank).toBe(1);
    for (let i = 1; i < boot.length; i += 1) {
      expect(boot[i - 1]!.winProbability).toBeGreaterThanOrEqual(
        boot[i]!.winProbability,
      );
    }
    const deep = boot.find((b) => b.name === "Sharp on a deep team")!;
    expect(deep.expectedGoals).toBeCloseTo(0.6 * games.get("deep")!, 10);
  });

  it("win probabilities are a normalised split across the pool", () => {
    const boot = forecastGoldenBoot(candidates, games);
    const sum = boot.reduce((total, b) => total + b.winProbability, 0);
    expect(sum).toBeCloseTo(1, 6);
  });

  it("ranks an equal finisher higher when his team plays more games", () => {
    const boot = forecastGoldenBoot(candidates, games);
    const onDeep = boot.findIndex((b) => b.name === "Sharp on a deep team");
    const onWeak = boot.findIndex((b) => b.name === "Sharp on a weak team");
    expect(onDeep).toBeLessThan(onWeak);
  });
});
