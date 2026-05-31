/**
 * Core domain types shared across the prediction engine and the UI.
 *
 * This module is pure data + type definitions — no React, no I/O — so the
 * group-stage, third-place and bracket logic can be unit-tested in isolation.
 */

/** Stable identifier for a team, e.g. `"england"`. */
export type TeamId = string;

/** Group labels A–L for the twelve groups of four. */
export type GroupId =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I"
  | "J"
  | "K"
  | "L";

export type Confederation =
  | "UEFA"
  | "CONMEBOL"
  | "CONCACAF"
  | "CAF"
  | "AFC"
  | "OFC";

/** A competing nation as shipped in `tournament.json`. */
export interface Team {
  readonly id: TeamId;
  readonly name: string;
  readonly confederation: Confederation;
  /** flagcdn / ISO 3166-1 code used to render the flag (e.g. `"gb-eng"`). */
  readonly flag: string;
  /** Seeding pot 1–4 from the Final Draw. */
  readonly pot: 1 | 2 | 3 | 4;
  readonly host?: boolean;
  readonly debutant?: boolean;
  /** Playoff route, if the slot was filled via a qualifying playoff. */
  readonly playoff?: string;
}

export interface Group {
  readonly id: GroupId;
  readonly teams: readonly Team[];
}

export interface TournamentMeta {
  readonly name: string;
  readonly hosts: readonly string[];
  readonly startDate: string;
  readonly endDate: string;
  readonly teamCount: number;
  readonly groupCount: number;
  readonly totalMatches: number;
  readonly favourites: readonly TeamId[];
  readonly defendingChampion: TeamId;
}

export interface TournamentData {
  readonly schemaVersion: number;
  readonly lastVerified: string;
  readonly source: string;
  readonly tournament: TournamentMeta;
  readonly groups: readonly Group[];
}

/** The three possible results, from the first-listed fixture side's perspective. */
export type MatchOutcome = "HOME" | "DRAW" | "AWAY";

/** An optional exact scoreline; required to rank third-placed teams by GD. */
export interface Scoreline {
  readonly home: number;
  readonly away: number;
}

/** A single neutral-site group-stage fixture. */
export interface GroupFixture {
  readonly id: string;
  readonly groupId: GroupId;
  readonly matchday: 1 | 2 | 3;
  /** First-listed team in the fixture order; not a true home side. */
  readonly homeId: TeamId;
  /** Second-listed team in the fixture order; not a true away side. */
  readonly awayId: TeamId;
}

/**
 * A user's prediction for one group fixture.
 *
 * `outcome` is always present (W/D/L is the minimum interaction). `scoreline`
 * is optional but, when supplied, is the source of truth and must agree with
 * `outcome`. Without scorelines, goal difference cannot be derived and the
 * best-third ranking falls back to a documented heuristic.
 */
export interface GroupPick {
  readonly outcome: MatchOutcome;
  readonly scoreline?: Scoreline;
}

/** A computed row in a group table. */
export interface StandingRow {
  readonly teamId: TeamId;
  readonly played: number;
  readonly won: number;
  readonly drawn: number;
  readonly lost: number;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
  readonly goalDifference: number;
  readonly points: number;
  /** 1-based finishing position within the group once the table is complete. */
  readonly rank: number;
}
