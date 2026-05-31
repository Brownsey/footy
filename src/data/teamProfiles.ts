import type { TeamId } from "@/domain/types";

import raw from "./teams.json";

export type ProfileConfidence = "skeleton" | "researched";

export interface TeamProfile {
  readonly teamId: TeamId;
  readonly modelRating: number;
  readonly qualificationRoute: string;
  readonly recentForm: string;
  readonly keyPlayers: readonly string[];
  readonly strengths: readonly string[];
  readonly weaknesses: readonly string[];
  readonly narrative: string;
  readonly confidence: ProfileConfidence;
}

export interface TeamProfileData {
  readonly schemaVersion: number;
  readonly lastVerified: string;
  readonly source: string;
  readonly profiles: readonly TeamProfile[];
}

export const teamProfileData = raw as TeamProfileData;

const profilesByTeamId: ReadonlyMap<TeamId, TeamProfile> = new Map(
  teamProfileData.profiles.map((profile) => [profile.teamId, profile]),
);

export function getTeamProfile(teamId: TeamId): TeamProfile {
  const profile = profilesByTeamId.get(teamId);
  if (!profile) throw new Error(`Missing team profile for ${teamId}`);
  return profile;
}

export function findTeamProfile(teamId: TeamId): TeamProfile | undefined {
  return profilesByTeamId.get(teamId);
}
