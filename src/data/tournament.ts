/**
 * Typed access to the static tournament seed data.
 *
 * `tournament.json` is the single source of truth for the draw (see the build
 * brief, §1). It is imported once and frozen behind typed accessors so the rest
 * of the app never touches the raw JSON shape directly.
 */

import type { Group, Team, TeamId, TournamentData } from "@/domain/types";

import raw from "./tournament.json";

export const tournamentData = raw as TournamentData;

export const groups: readonly Group[] = tournamentData.groups;

/** All 48 teams, flattened from the twelve groups. */
export const allTeams: readonly Team[] = groups.flatMap((g) => g.teams);

const teamsById: ReadonlyMap<TeamId, Team> = new Map(
  allTeams.map((team) => [team.id, team]),
);

/** Look up a team by id, throwing if it is unknown (data bug, not user input). */
export function getTeam(id: TeamId): Team {
  const team = teamsById.get(id);
  if (!team) throw new Error(`Unknown team id: ${id}`);
  return team;
}

/** Look up a team by id, returning `undefined` if absent. */
export function findTeam(id: TeamId): Team | undefined {
  return teamsById.get(id);
}
