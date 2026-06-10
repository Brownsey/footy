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
