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
    homeClimate: "temperate",
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

  it("breaks the matchup down into head-to-head factors", () => {
    const insight = getMatchupInsight(
      { team: team("alpha", "Alpha"), profile: profile("alpha", 1800) },
      { team: team("bravo", "Bravo"), profile: profile("bravo", 1600) },
    );

    const labels = insight.keyFactors.map((factor) => factor.label);
    expect(labels).toContain("Model rating");
    expect(labels).toContain("FIFA ranking");
    expect(labels).toContain("Form");
    expect(labels).toContain("Pedigree");

    const rating = insight.keyFactors.find((f) => f.label === "Model rating")!;
    expect(rating.edge).toBe("A");
  });

  it("flips the ranking edge since a lower FIFA number is better", () => {
    const insight = getMatchupInsight(
      {
        team: team("alpha", "Alpha"),
        profile: { ...profile("alpha", 1700), fifaRanking: 30 },
      },
      {
        team: team("bravo", "Bravo"),
        profile: { ...profile("bravo", 1700), fifaRanking: 5 },
      },
    );

    const ranking = insight.keyFactors.find((f) => f.label === "FIFA ranking")!;
    expect(ranking.edge).toBe("B");
  });

  it("synthesises a 'what to expect' note where a strength meets a weakness", () => {
    const fast = {
      team: team("fast", "Fast"),
      profile: {
        ...profile("fast", 1700),
        strengths: ["Pace and physicality in transition"],
      },
    };
    const exposed = {
      team: team("exposed", "Exposed"),
      profile: {
        ...profile("exposed", 1700),
        weaknesses: ["Defensive lapses under sustained pressure"],
      },
    };
    const insight = getMatchupInsight(fast, exposed);

    expect(insight.whatToExpect.length).toBeGreaterThan(0);
    expect(insight.whatToExpect.some((note) => note.includes("Fast"))).toBe(
      true,
    );
  });

  it("detects a game-control clash against a side that cannot chase", () => {
    const controller = {
      team: team("controller", "Controller"),
      profile: {
        ...profile("controller", 1700),
        strengths: ["Defensive resilience and game management"],
      },
    };
    const reactive = {
      team: team("reactive", "Reactive"),
      profile: {
        ...profile("reactive", 1700),
        weaknesses: ["Struggles to chase games"],
      },
    };
    const insight = getMatchupInsight(controller, reactive);
    expect(
      insight.whatToExpect.some((note) => note.includes("Controller")),
    ).toBe(true);
  });

  it("falls back to a generic expectation when no clash is detected", () => {
    const insight = getMatchupInsight(
      { team: team("alpha", "Alpha"), profile: profile("alpha", 1900) },
      { team: team("bravo", "Bravo"), profile: profile("bravo", 1500) },
    );
    expect(insight.whatToExpect).toHaveLength(1);
    expect(insight.whatToExpect[0]).toContain("Alpha");
  });

  it("projects more goals for the stronger side and respects the floor", () => {
    const insight = getMatchupInsight(
      { team: team("strong", "Strong"), profile: profile("strong", 2000) },
      { team: team("weak", "Weak"), profile: profile("weak", 1400) },
    );
    expect(insight.expectedGoals.sideA).toBeGreaterThan(
      insight.expectedGoals.sideB,
    );
    expect(insight.expectedGoals.sideB).toBeGreaterThanOrEqual(0.3);
  });

  it("raises the host's projected goals via home advantage", () => {
    const sides = [
      { team: team("h", "H"), profile: profile("h", 1700) },
      { team: team("a", "A"), profile: profile("a", 1700) },
    ] as const;
    const neutral = getMatchupInsight(sides[0], sides[1]);
    const hosted = getMatchupInsight(sides[0], sides[1], { hostSide: "A" });
    expect(hosted.expectedGoals.sideA).toBeGreaterThan(
      neutral.expectedGoals.sideA,
    );
  });

  it("lifts the host side's win probability and adds a venue factor", () => {
    const sides = [
      { team: team("home", "Home"), profile: profile("home", 1700) },
      { team: team("away", "Away"), profile: profile("away", 1700) },
    ] as const;

    const neutral = getMatchupInsight(sides[0], sides[1]);
    const hosted = getMatchupInsight(sides[0], sides[1], { hostSide: "A" });

    expect(hosted.outcomes.HOME.probability).toBeGreaterThan(
      neutral.outcomes.HOME.probability,
    );
    expect(hosted.keyFactors.some((f) => f.label === "Venue")).toBe(true);
    expect(neutral.keyFactors.some((f) => f.label === "Venue")).toBe(false);

    const total = hosted.options.reduce((sum, o) => sum + o.probability, 0);
    expect(total).toBeCloseTo(1, 8);
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
