/**
 * Group-stage model: fixture generation and table computation.
 *
 * A World Cup group is a four-team round robin (six matches). The user predicts
 * each match; this module turns those picks into a ranked table so the group's
 * 1st, 2nd and 3rd-placed teams can be derived automatically.
 */

import type {
  Group,
  GroupFixture,
  GroupId,
  GroupPick,
  MatchOutcome,
  Scoreline,
  StandingRow,
  Team,
  TeamId,
} from "./types";

const POINTS_FOR_WIN = 3;
const POINTS_FOR_DRAW = 1;

/**
 * Round-robin pairings for four teams (indices into the group's team list).
 *
 * Each of the three matchdays has two matches; every team meets each other
 * exactly once. The first index is simply the first-listed fixture side; World
 * Cup group fixtures are neutral-site matches rather than home/away legs.
 */
const ROUND_ROBIN: ReadonlyArray<{
  readonly matchday: 1 | 2 | 3;
  readonly pairs: ReadonlyArray<readonly [number, number]>;
}> = [
  {
    matchday: 1,
    pairs: [
      [0, 1],
      [2, 3],
    ],
  },
  {
    matchday: 2,
    pairs: [
      [0, 2],
      [3, 1],
    ],
  },
  {
    matchday: 3,
    pairs: [
      [0, 3],
      [1, 2],
    ],
  },
];

/**
 * Representative scoreline used when the user supplies only a W/D/L outcome.
 *
 * Goal difference is needed to rank third-placed teams (see `thirdPlace.ts`).
 * When an exact scoreline is not provided we assume a minimal one-goal margin
 * so partial data still produces a sensible, deterministic table.
 */
export function outcomeToScoreline(outcome: MatchOutcome): Scoreline {
  switch (outcome) {
    case "HOME":
      return { home: 1, away: 0 };
    case "AWAY":
      return { home: 0, away: 1 };
    case "DRAW":
      return { home: 0, away: 0 };
  }
}

/** Derive the outcome implied by a scoreline. */
export function scorelineToOutcome(score: Scoreline): MatchOutcome {
  if (score.home > score.away) return "HOME";
  if (score.home < score.away) return "AWAY";
  return "DRAW";
}

/** Generate the six fixtures for a group, in matchday order. */
export function generateGroupFixtures(group: Group): GroupFixture[] {
  const fixtures: GroupFixture[] = [];
  for (const round of ROUND_ROBIN) {
    for (const [homeIdx, awayIdx] of round.pairs) {
      const home = group.teams[homeIdx];
      const away = group.teams[awayIdx];
      if (!home || !away) continue;
      fixtures.push({
        id: fixtureId(group.id, home.id, away.id),
        groupId: group.id,
        matchday: round.matchday,
        homeId: home.id,
        awayId: away.id,
      });
    }
  }
  return fixtures;
}

/** Deterministic, stable fixture identifier. */
export function fixtureId(
  groupId: GroupId,
  homeId: TeamId,
  awayId: TeamId,
): string {
  return `G${groupId}:${homeId}-vs-${awayId}`;
}

interface MutableRow {
  teamId: TeamId;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
}

/**
 * Compute the ranked table for a group from the user's picks.
 *
 * @param group - the group whose four teams are being ranked.
 * @param fixtures - the group's six fixtures (from {@link generateGroupFixtures}).
 * @param picks - map of fixture id to the user's prediction; fixtures without a
 *   pick are treated as not-yet-played.
 * @returns one {@link StandingRow} per team, sorted best-to-worst with a 1-based
 *   `rank`. Ties break on points → goal difference → goals for → seeding pot →
 *   team id, which is fully deterministic.
 */
export function computeStandings(
  group: Group,
  fixtures: readonly GroupFixture[],
  picks: Readonly<Record<string, GroupPick>>,
): StandingRow[] {
  const rows = new Map<TeamId, MutableRow>();
  for (const team of group.teams) {
    rows.set(team.id, blankRow(team.id));
  }

  for (const fixture of fixtures) {
    const pick = picks[fixture.id];
    if (!pick) continue;
    const score = pick.scoreline ?? outcomeToScoreline(pick.outcome);
    applyResult(rows, fixture, score);
  }

  const potById = new Map<TeamId, number>(
    group.teams.map((t: Team) => [t.id, t.pot]),
  );
  return finalise(rows, potById);
}

function blankRow(teamId: TeamId): MutableRow {
  return {
    teamId,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
  };
}

function applyResult(
  rows: Map<TeamId, MutableRow>,
  fixture: GroupFixture,
  score: Scoreline,
): void {
  const home = rows.get(fixture.homeId);
  const away = rows.get(fixture.awayId);
  if (!home || !away) return;

  home.played += 1;
  away.played += 1;
  home.goalsFor += score.home;
  home.goalsAgainst += score.away;
  away.goalsFor += score.away;
  away.goalsAgainst += score.home;

  if (score.home > score.away) {
    home.won += 1;
    away.lost += 1;
  } else if (score.home < score.away) {
    away.won += 1;
    home.lost += 1;
  } else {
    home.drawn += 1;
    away.drawn += 1;
  }
}

function finalise(
  rows: Map<TeamId, MutableRow>,
  potById: Map<TeamId, number>,
): StandingRow[] {
  const scored = [...rows.values()].map((row) => ({
    ...row,
    goalDifference: row.goalsFor - row.goalsAgainst,
    points: row.won * POINTS_FOR_WIN + row.drawn * POINTS_FOR_DRAW,
  }));

  scored.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) {
      return b.goalDifference - a.goalDifference;
    }
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    const potA = potById.get(a.teamId) ?? 99;
    const potB = potById.get(b.teamId) ?? 99;
    if (potA !== potB) return potA - potB;
    return a.teamId.localeCompare(b.teamId);
  });

  return scored.map((row, index) => ({ ...row, rank: index + 1 }));
}

/** True when every fixture in the group has a recorded pick. */
export function isGroupComplete(
  fixtures: readonly GroupFixture[],
  picks: Readonly<Record<string, GroupPick>>,
): boolean {
  return fixtures.every((fixture) => picks[fixture.id] !== undefined);
}
