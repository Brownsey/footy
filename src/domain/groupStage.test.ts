import { describe, expect, it } from "vitest";

import {
  computeStandings,
  fixtureId,
  generateGroupFixtures,
  isGroupComplete,
  outcomeToScoreline,
  scorelineToOutcome,
} from "./groupStage";
import type { Group, GroupPick, StandingRow, Team } from "./types";

function team(id: string, pot: 1 | 2 | 3 | 4): Team {
  return { id, name: id, confederation: "UEFA", flag: "xx", pot };
}

const GROUP: Group = {
  id: "A",
  teams: [
    team("alpha", 1),
    team("bravo", 2),
    team("charlie", 3),
    team("delta", 4),
  ],
};

const FIXTURES = generateGroupFixtures(GROUP);

/** Build a pick from an exact scoreline (outcome derived from the goals). */
function withScore(home: number, away: number): GroupPick {
  return {
    outcome: scorelineToOutcome({ home, away }),
    scoreline: { home, away },
  };
}

/** Find a team's row, failing loudly if the table is missing it. */
function rowOf(table: readonly StandingRow[], teamId: string): StandingRow {
  const row = table.find((r) => r.teamId === teamId);
  if (!row) throw new Error(`No standing row for ${teamId}`);
  return row;
}

describe("generateGroupFixtures", () => {
  it("produces six fixtures for a four-team group", () => {
    expect(FIXTURES).toHaveLength(6);
  });

  it("schedules every team to play three matches", () => {
    const appearances = new Map<string, number>();
    for (const f of FIXTURES) {
      appearances.set(f.homeId, (appearances.get(f.homeId) ?? 0) + 1);
      appearances.set(f.awayId, (appearances.get(f.awayId) ?? 0) + 1);
    }
    expect([...appearances.values()]).toEqual([3, 3, 3, 3]);
  });

  it("pairs every team with every other exactly once", () => {
    const pairs = FIXTURES.map((f) => [f.homeId, f.awayId].sort().join("|"));
    expect(new Set(pairs).size).toBe(6);
  });

  it("derives stable, unique fixture ids", () => {
    const ids = FIXTURES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(fixtureId("A", "alpha", "bravo"));
  });
});

describe("outcome <-> scoreline helpers", () => {
  it("maps outcomes to representative one-goal scorelines", () => {
    expect(outcomeToScoreline("HOME")).toEqual({ home: 1, away: 0 });
    expect(outcomeToScoreline("AWAY")).toEqual({ home: 0, away: 1 });
    expect(outcomeToScoreline("DRAW")).toEqual({ home: 0, away: 0 });
  });

  it("recovers the outcome from a scoreline", () => {
    expect(scorelineToOutcome({ home: 3, away: 1 })).toBe("HOME");
    expect(scorelineToOutcome({ home: 0, away: 2 })).toBe("AWAY");
    expect(scorelineToOutcome({ home: 2, away: 2 })).toBe("DRAW");
  });
});

describe("computeStandings", () => {
  it("returns four ranked rows even with no picks", () => {
    const table = computeStandings(GROUP, FIXTURES, {});
    expect(table).toHaveLength(4);
    expect(table.every((r) => r.played === 0)).toBe(true);
    expect(table.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
  });

  it("awards three points for a win and one for a draw", () => {
    const picks: Record<string, GroupPick> = {
      [fixtureId("A", "alpha", "bravo")]: { outcome: "HOME" },
      [fixtureId("A", "charlie", "delta")]: { outcome: "DRAW" },
    };
    const table = computeStandings(GROUP, FIXTURES, picks);
    expect(rowOf(table, "alpha").points).toBe(3);
    expect(rowOf(table, "bravo").points).toBe(0);
    expect(rowOf(table, "charlie").points).toBe(1);
    expect(rowOf(table, "delta").points).toBe(1);
  });

  it("ranks a team that wins everything first", () => {
    const picks: Record<string, GroupPick> = {};
    for (const f of FIXTURES) {
      picks[f.id] = { outcome: "HOME" };
    }
    const table = computeStandings(GROUP, FIXTURES, picks);
    expect(rowOf(table, "alpha").points).toBe(9);
    expect(rowOf(table, "alpha").won).toBe(3);
    expect(table[0]?.teamId).toBe("alpha");
  });

  it("breaks points ties on goal difference then goals scored", () => {
    const picks: Record<string, GroupPick> = {
      [fixtureId("A", "alpha", "bravo")]: withScore(5, 0),
      [fixtureId("A", "charlie", "delta")]: withScore(1, 0),
    };
    const table = computeStandings(GROUP, FIXTURES, picks);
    // alpha and charlie both have 3 pts; alpha's +5 GD ranks above charlie's +1.
    expect(table[0]?.teamId).toBe("alpha");
    expect(table[1]?.teamId).toBe("charlie");
  });

  it("uses provided scorelines over representative ones for GD", () => {
    const picks: Record<string, GroupPick> = {
      [fixtureId("A", "alpha", "bravo")]: withScore(4, 1),
    };
    const table = computeStandings(GROUP, FIXTURES, picks);
    const alpha = rowOf(table, "alpha");
    expect(alpha.goalsFor).toBe(4);
    expect(alpha.goalsAgainst).toBe(1);
    expect(alpha.goalDifference).toBe(3);
  });
});

describe("isGroupComplete", () => {
  it("is false until all six fixtures have picks", () => {
    expect(isGroupComplete(FIXTURES, {})).toBe(false);
    const picks = Object.fromEntries(
      FIXTURES.slice(0, 5).map((f): [string, GroupPick] => [
        f.id,
        { outcome: "HOME" },
      ]),
    );
    expect(isGroupComplete(FIXTURES, picks)).toBe(false);
  });

  it("is true once every fixture has a pick", () => {
    const picks = Object.fromEntries(
      FIXTURES.map((f): [string, GroupPick] => [f.id, { outcome: "HOME" }]),
    );
    expect(isGroupComplete(FIXTURES, picks)).toBe(true);
  });
});
