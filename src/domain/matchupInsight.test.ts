import { describe, expect, it } from "vitest";

import { getMatchupInsight } from "./matchupInsight";
import type { TeamProfile } from "@/data/teamProfiles";
import type { Team } from "./types";

function team(id: string, name: string): Team {
  return { id, name, confederation: "UEFA", flag: "xx", pot: 1 };
}

function profile(teamId: string, rating: number): TeamProfile {
  return {
    teamId,
    fifaRanking: 10,
    modelRating: rating,
    qualificationRoute: "Test",
    recentForm: "Test",
    worldCupPedigree: "Test pedigree",
    keyPlayers: ["Test Player"],
    strengths: ["Defensive organisation"],
    weaknesses: ["Depth"],
    narrative: "Test profile",
    confidence: "researched",
  };
}

describe("getMatchupInsight", () => {
  it("returns probabilities for both teams and the draw", () => {
    const insight = getMatchupInsight(
      { team: team("alpha", "Alpha"), profile: profile("alpha", 1800) },
      { team: team("bravo", "Bravo"), profile: profile("bravo", 1600) },
    );

    expect(insight.options.map((option) => option.outcome)).toEqual([
      "HOME",
      "DRAW",
      "AWAY",
    ]);
    expect(insight.options.every((option) => option.reasons.length > 0)).toBe(
      true,
    );
  });

  it("normalises probabilities to one", () => {
    const insight = getMatchupInsight(
      { team: team("alpha", "Alpha"), profile: profile("alpha", 1800) },
      { team: team("bravo", "Bravo"), profile: profile("bravo", 1800) },
    );
    const total = insight.options.reduce(
      (sum, option) => sum + option.probability,
      0,
    );

    expect(total).toBeCloseTo(1, 8);
  });
});
