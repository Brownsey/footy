import { describe, expect, it } from "vitest";

import {
  QUALIFYING_THIRDS,
  rankThirdPlacedTeams,
  thirdPlacedOf,
  type ThirdPlaceCandidate,
} from "./thirdPlace";
import type { GroupId, StandingRow } from "./types";

/** Minimal third-placed row; only ranking-relevant fields matter here. */
function third(
  teamId: string,
  points: number,
  goalDifference: number,
  goalsFor: number,
): StandingRow {
  return {
    teamId,
    played: 3,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor,
    goalsAgainst: goalsFor - goalDifference,
    goalDifference,
    points,
    rank: 3,
  };
}

function candidate(
  groupId: GroupId,
  points: number,
  gd: number,
  gf: number,
  teamId = `team-${groupId}`,
): ThirdPlaceCandidate {
  return { groupId, row: third(teamId, points, gd, gf) };
}

/** Twelve candidates with strictly decreasing strength by group letter. */
function twelveDistinct(): ThirdPlaceCandidate[] {
  const groups: GroupId[] = [
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
    "G",
    "H",
    "I",
    "J",
    "K",
    "L",
  ];
  return groups.map((g, i) => candidate(g, 12 - i, 12 - i, 12 - i));
}

describe("thirdPlacedOf", () => {
  it("extracts the row ranked third", () => {
    const table: StandingRow[] = [
      { ...third("first", 9, 6, 7), rank: 1 },
      { ...third("second", 6, 2, 5), rank: 2 },
      { ...third("third", 3, 0, 3), rank: 3 },
      { ...third("fourth", 0, -8, 1), rank: 4 },
    ];
    expect(thirdPlacedOf("A", table).row.teamId).toBe("third");
  });

  it("throws if a group has no third-placed team", () => {
    expect(() => thirdPlacedOf("A", [])).toThrow(/no third-placed/);
  });
});

describe("rankThirdPlacedTeams", () => {
  it("qualifies the best eight of twelve", () => {
    const { ranked, qualifiers } = rankThirdPlacedTeams(twelveDistinct());
    expect(ranked).toHaveLength(12);
    expect(qualifiers).toHaveLength(QUALIFYING_THIRDS);
    expect(qualifiers.every((t) => t.qualified)).toBe(true);
    // Strongest is group A, weakest four (I–L) miss out.
    expect(qualifiers[0]?.groupId).toBe("A");
    expect(ranked.slice(8).map((t) => t.groupId)).toEqual(["I", "J", "K", "L"]);
  });

  it("orders points over goal difference over goals scored", () => {
    const candidates: ThirdPlaceCandidate[] = [
      candidate("A", 3, 0, 2),
      candidate("B", 4, 0, 1), // more points -> first
      candidate("C", 3, 5, 1), // same points as A, better GD -> above A
      candidate("D", 3, 0, 9), // same points & GD as A, more GF -> above A
    ];
    const order = rankThirdPlacedTeams(candidates).ranked.map((t) => t.groupId);
    expect(order).toEqual(["B", "C", "D", "A"]);
  });

  it("falls back to a deterministic group-letter tiebreak", () => {
    const candidates: ThirdPlaceCandidate[] = [
      candidate("F", 3, 1, 2),
      candidate("C", 3, 1, 2),
      candidate("A", 3, 1, 2),
    ];
    const order = rankThirdPlacedTeams(candidates).ranked.map((t) => t.groupId);
    expect(order).toEqual(["A", "C", "F"]);
  });

  it("flags when the 8th and 9th teams are a derivable tie", () => {
    const candidates = twelveDistinct();
    // Force groups H (8th-ish) and I onto identical derivable criteria.
    const tied = candidates.map((c) =>
      c.groupId === "H" || c.groupId === "I"
        ? candidate(c.groupId, 4, 0, 3)
        : c,
    );
    expect(rankThirdPlacedTeams(tied).tiebreakNeeded).toBe(true);
  });

  it("does not flag a tiebreak when the cut is clean", () => {
    expect(rankThirdPlacedTeams(twelveDistinct()).tiebreakNeeded).toBe(false);
  });
});
