import type { TeamId } from "@/domain/types";

import raw from "./teams.json";

export type ProfileConfidence = "skeleton" | "researched";

/**
 * Home-climate adaptation bucket for a June–July tournament across (often hot)
 * North American venues. Drives the "Heat & travel" prediction philosophy.
 */
export type HomeClimate = "hot" | "warm" | "temperate" | "cold";

export interface TeamProfile {
  readonly teamId: TeamId;
  /** Published FIFA/Coca-Cola world ranking position (lower is better). */
  readonly fifaRanking: number;
  /** Elo-scaled rating that powers the probability engine. */
  readonly modelRating: number;
  /** Climate the side's football heartland is acclimatised to. */
  readonly homeClimate: HomeClimate;
  readonly qualificationRoute: string;
  readonly recentForm: string;
  /** Historical World Cup record / pedigree, one line. */
  readonly worldCupPedigree: string;
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
