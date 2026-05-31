import { describe, expect, it } from "vitest";

import {
  officialKnockoutMatches,
  resolveThirdPlaceRoundOf32Allocation,
  roundOf32Matches,
} from "./bracket";
import type { RankedThird } from "./thirdPlace";
import type { GroupId } from "./types";

const OPTION_ONE_GROUPS: readonly GroupId[] = [
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
];

function rankedThird(groupId: GroupId): RankedThird {
  return {
    groupId,
    teamId: `team-${groupId}`,
    points: 4,
    goalDifference: 0,
    goalsFor: 3,
    rank: 1,
    qualified: true,
  };
}

describe("official knockout bracket wiring", () => {
  it("defines every official knockout match from M73 to M104", () => {
    expect(roundOf32Matches).toHaveLength(16);
    expect(officialKnockoutMatches).toHaveLength(32);
    expect(officialKnockoutMatches[0]?.id).toBe("M73");
    expect(officialKnockoutMatches.at(-1)?.id).toBe("M104");
  });

  it("assigns option 1 third-place teams to the correct R32 matches", () => {
    const allocation = resolveThirdPlaceRoundOf32Allocation(
      OPTION_ONE_GROUPS.map(rankedThird),
    );

    expect(allocation.option).toBe(1);
    expect(allocation.assignments).toContainEqual({
      slot: "1E",
      matchId: "M74",
      groupWinner: "E",
      thirdGroup: "F",
      teamId: "team-F",
    });
    expect(allocation.assignments).toContainEqual({
      slot: "1A",
      matchId: "M79",
      groupWinner: "A",
      thirdGroup: "E",
      teamId: "team-E",
    });
  });
});
