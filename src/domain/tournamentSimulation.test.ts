import { describe, expect, it } from "vitest";

import { getTeamProfile } from "@/data/teamProfiles";
import { groups } from "@/data/tournament";

import { simulateTournament } from "./tournamentSimulation";

const ratingOf = (id: string) => getTeamProfile(id).modelRating;

describe("simulateTournament", () => {
  it("is leak-free: title probabilities sum to 1", () => {
    const odds = simulateTournament(groups, ratingOf, { iterations: 4000 });
    const sum = odds.reduce((total, o) => total + o.titleProbability, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it("reach-stage shares sum to the slots available per round", () => {
    const odds = simulateTournament(groups, ratingOf, { iterations: 4000 });
    const total = (pick: (o: (typeof odds)[number]) => number) =>
      odds.reduce((sum, o) => sum + pick(o), 0);
    expect(total((o) => o.pQualify)).toBeCloseTo(32, 6);
    expect(total((o) => o.pReachR16)).toBeCloseTo(16, 6);
    expect(total((o) => o.pReachQuarter)).toBeCloseTo(8, 6);
    expect(total((o) => o.pReachSemi)).toBeCloseTo(4, 6);
    expect(total((o) => o.pReachFinal)).toBeCloseTo(2, 6);
  });

  it("gives each team a monotonically narrowing road to the title", () => {
    const odds = simulateTournament(groups, ratingOf, { iterations: 4000 });
    for (const o of odds) {
      expect(o.pQualify).toBeGreaterThanOrEqual(o.pReachR16);
      expect(o.pReachR16).toBeGreaterThanOrEqual(o.pReachQuarter);
      expect(o.pReachQuarter).toBeGreaterThanOrEqual(o.pReachSemi);
      expect(o.pReachSemi).toBeGreaterThanOrEqual(o.pReachFinal);
      expect(o.pReachFinal).toBeGreaterThanOrEqual(o.titleProbability);
    }
  });

  it("covers the whole field and ranks favourite-first", () => {
    const odds = simulateTournament(groups, ratingOf, { iterations: 2000 });
    expect(odds).toHaveLength(groups.flatMap((g) => g.teams).length);
    for (let i = 1; i < odds.length; i += 1) {
      expect(odds[i - 1]!.titleProbability).toBeGreaterThanOrEqual(
        odds[i]!.titleProbability,
      );
    }
    expect(odds[0]!.rank).toBe(1);
  });

  it("crowns the field's strongest side as clear favourite", () => {
    const odds = simulateTournament(groups, ratingOf, { iterations: 4000 });
    // Spain are the top-rated team and the market/Opta favourite.
    expect(odds[0]!.teamId).toBe("spain");
    expect(odds[0]!.titleProbability).toBeGreaterThan(0.1);
  });

  it("is deterministic for a fixed seed", () => {
    const a = simulateTournament(groups, ratingOf, { iterations: 1500, seed: 7 });
    const b = simulateTournament(groups, ratingOf, { iterations: 1500, seed: 7 });
    expect(a).toEqual(b);
  });
});
