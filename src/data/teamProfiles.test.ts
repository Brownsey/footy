import { describe, expect, it } from "vitest";

import { allTeams } from "./tournament";
import { getTeamProfile, teamProfileData } from "./teamProfiles";

describe("team profiles", () => {
  it("has one scouting skeleton for every tournament team", () => {
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
});
