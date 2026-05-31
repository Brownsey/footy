import type {
  GroupFixture,
  GroupPick,
  MatchOutcome,
  Scoreline,
  Team,
} from "./types";

export type PickState = Record<string, GroupPick>;

export function defaultScoreline(outcome: MatchOutcome): Scoreline {
  switch (outcome) {
    case "HOME":
      return { home: 2, away: 1 };
    case "AWAY":
      return { home: 1, away: 2 };
    case "DRAW":
      return { home: 1, away: 1 };
  }
}

export function seededOutcome(sideA: Team, sideB: Team): MatchOutcome {
  if (sideA.pot < sideB.pot) return "HOME";
  if (sideB.pot < sideA.pot) return "AWAY";
  return "DRAW";
}

export function seededScoreline(
  sideA: Team,
  sideB: Team,
  outcome: MatchOutcome,
): Scoreline {
  const gap = Math.abs(sideA.pot - sideB.pot);
  if (outcome === "DRAW") return { home: 1, away: 1 };
  if (outcome === "HOME") {
    return gap >= 2 ? { home: 3, away: 1 } : { home: 2, away: 1 };
  }
  return gap >= 2 ? { home: 1, away: 3 } : { home: 1, away: 2 };
}

export function buildSeededPicks(
  fixtureGroups: readonly {
    readonly fixtures: readonly GroupFixture[];
  }[],
  getTeam: (teamId: string) => Team,
): PickState {
  const seededPicks: PickState = {};
  for (const { fixtures } of fixtureGroups) {
    for (const fixture of fixtures) {
      const sideA = getTeam(fixture.homeId);
      const sideB = getTeam(fixture.awayId);
      const outcome = seededOutcome(sideA, sideB);
      seededPicks[fixture.id] = {
        outcome,
        scoreline: seededScoreline(sideA, sideB, outcome),
      };
    }
  }
  return seededPicks;
}
