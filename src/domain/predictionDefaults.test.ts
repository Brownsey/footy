import { describe, expect, it } from "vitest";

import {
  buildSeededPicks,
  defaultScoreline,
  seededOutcome,
} from "./predictionDefaults";
import type { GroupFixture, Team } from "./types";

function team(id: string, pot: 1 | 2 | 3 | 4): Team {
  return { id, name: id, confederation: "UEFA", flag: "xx", pot };
}

describe("prediction defaults", () => {
  it("uses sensible default scorelines for every outcome", () => {
    expect(defaultScoreline("HOME")).toEqual({ home: 2, away: 1 });
    expect(defaultScoreline("DRAW")).toEqual({ home: 1, away: 1 });
    expect(defaultScoreline("AWAY")).toEqual({ home: 1, away: 2 });
  });

  it("seeds the stronger pot side as the winner", () => {
    expect(seededOutcome(team("seed", 1), team("outsider", 4))).toBe("HOME");
    expect(seededOutcome(team("outsider", 4), team("seed", 1))).toBe("AWAY");
    expect(seededOutcome(team("level-a", 2), team("level-b", 2))).toBe("DRAW");
  });

  it("builds a pick for every provided fixture", () => {
    const fixture: GroupFixture = {
      id: "GZ:a-vs-b",
      groupId: "A",
      matchday: 1,
      homeId: "a",
      awayId: "b",
    };
    const picks = buildSeededPicks([{ fixtures: [fixture] }], (id) =>
      id === "a" ? team("a", 1) : team("b", 4),
    );

    expect(picks[fixture.id]).toEqual({
      outcome: "HOME",
      scoreline: { home: 3, away: 1 },
    });
  });
});
