import { describe, expect, it } from "vitest";

import { allTeams } from "./tournament";
import { getTeamProfile, teamProfileData } from "./teamProfiles";

describe("team profiles", () => {
  it("has one profile for every tournament team", () => {
    const teamIds = allTeams.map((team) => team.id).sort();
    const profileIds = teamProfileData.profiles
      .map((profile) => profile.teamId)
      .sort();

    expect(profileIds).toEqual(teamIds);
  });

  it("provides model inputs and explanation hooks for every profile", () => {
    for (const team of allTeams) {
      const profile = getTeamProfile(team.id);
      expect(profile.modelRating).toBeGreaterThan(0);
      expect(profile.strengths.length).toBeGreaterThan(0);
      expect(profile.weaknesses.length).toBeGreaterThan(0);
      expect(profile.narrative.length).toBeGreaterThan(0);
    }
  });

  it("carries fully researched scouting data for every profile", () => {
    for (const team of allTeams) {
      const profile = getTeamProfile(team.id);
      expect(profile.confidence).toBe("researched");
      expect(profile.fifaRanking).toBeGreaterThan(0);
      expect(profile.keyPlayers.length).toBeGreaterThanOrEqual(3);
      expect(profile.recentForm).not.toMatch(/research pending/i);
      expect(profile.worldCupPedigree.length).toBeGreaterThan(0);
    }
  });

  it("keeps FIFA ranking and model rating directionally consistent", () => {
    const profiles = [...teamProfileData.profiles];
    const byRank = [...profiles].sort((a, b) => a.fifaRanking - b.fifaRanking);
    const topByRank = byRank.slice(0, 8).map((p) => p.teamId);
    const topByRating = [...profiles]
      .sort((a, b) => b.modelRating - a.modelRating)
      .slice(0, 8)
      .map((p) => p.teamId);

    // The strongest eight by ranking and by model rating should largely agree.
    const overlap = topByRank.filter((id) => topByRating.includes(id));
    expect(overlap.length).toBeGreaterThanOrEqual(6);
  });
});
