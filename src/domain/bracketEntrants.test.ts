import { describe, expect, it } from "vitest";

import { getTeamProfile } from "@/data/teamProfiles";
import { groups } from "@/data/tournament";

import {
  buildEntrants,
  R32_LAYOUT,
  THIRD_SLOT_FORBIDDEN,
  THIRD_SLOTS,
} from "./bracketEntrants";
import { buildPredictionSets } from "./claudePredicts";
import { computeStandings, generateGroupFixtures } from "./groupStage";
import type { GroupSummary } from "./tournamentSummary";
import type { GroupId, TeamId } from "./types";

// A complete, realistic set of group tables: load the "chalk" Claude Predicts
// picks (a full slate) and compute every group's standings from them.
const chalkPicks = buildPredictionSets(groups, getTeamProfile).find(
  (set) => set.id === "chalk",
)!.picks;

const completeSummaries: GroupSummary[] = groups.map((group) => {
  const fixtures = generateGroupFixtures(group);
  return {
    group,
    fixtures,
    table: computeStandings(group, fixtures, chalkPicks),
    picked: fixtures.length,
    complete: true,
  };
});

const groupOf = new Map<TeamId, GroupId>(
  completeSummaries.flatMap((summary) =>
    summary.table.map((row) => [row.teamId, summary.group.id]),
  ),
);

function rankTeam(groupId: GroupId, rank: number): TeamId {
  const summary = completeSummaries.find((s) => s.group.id === groupId)!;
  return summary.table.find((row) => row.rank === rank)!.teamId;
}

describe("R32_LAYOUT", () => {
  it("describes 32 entrants with eight third-slots", () => {
    expect(R32_LAYOUT).toHaveLength(32);
    const thirds = R32_LAYOUT.filter((slot) => slot.kind === "third");
    expect(thirds).toHaveLength(THIRD_SLOTS);
  });

  it("keeps each group's winner and runner-up in different ties", () => {
    for (let tie = 0; tie < 16; tie += 1) {
      const a = R32_LAYOUT[tie * 2]!;
      const b = R32_LAYOUT[tie * 2 + 1]!;
      const sameGroupClash =
        a.kind !== "third" &&
        b.kind !== "third" &&
        "group" in a &&
        "group" in b &&
        a.group === b.group;
      expect(sameGroupClash).toBe(false);
    }
  });
});

describe("buildEntrants", () => {
  it("returns 32 distinct, fully-resolved entrants once all groups finish", () => {
    const entrants = buildEntrants(completeSummaries);
    expect(entrants).toHaveLength(32);
    expect(entrants.every((id) => id !== undefined)).toBe(true);
    expect(new Set(entrants).size).toBe(32);
  });

  it("places the right group winners and runners-up", () => {
    const entrants = buildEntrants(completeSummaries);
    expect(entrants[0]).toBe(rankTeam("A", 1)); // winner A
    expect(entrants[1]).toBe(rankTeam("B", 2)); // runner-up B
    expect(entrants[17]).toBe(rankTeam("A", 2)); // runner-up A
  });

  it("never sends a third into a tie against its own group", () => {
    const entrants = buildEntrants(completeSummaries);
    R32_LAYOUT.forEach((slot, index) => {
      if (slot.kind !== "third") return;
      const teamId = entrants[index];
      expect(teamId).toBeDefined();
      expect(groupOf.get(teamId!)).not.toBe(THIRD_SLOT_FORBIDDEN[slot.seed]);
    });
  });

  it("resolves eight genuine third-placed qualifiers", () => {
    const entrants = buildEntrants(completeSummaries);
    const thirdTeams = R32_LAYOUT.flatMap((slot, index) =>
      slot.kind === "third" ? [entrants[index]!] : [],
    );
    expect(thirdTeams).toHaveLength(8);
    for (const teamId of thirdTeams) {
      const summary = completeSummaries.find(
        (s) => s.group.id === groupOf.get(teamId),
      );
      expect(summary!.table.find((row) => row.teamId === teamId)!.rank).toBe(3);
    }
  });

  it("leaves slots undefined while groups are incomplete", () => {
    const partial = completeSummaries.map((summary, index) =>
      index === 0 ? { ...summary, complete: false } : summary,
    );
    const entrants = buildEntrants(partial);
    expect(entrants[0]).toBeUndefined(); // winner A — group A incomplete
    // Thirds need every group complete, so all eight stay undefined.
    R32_LAYOUT.forEach((slot, index) => {
      if (slot.kind === "third") expect(entrants[index]).toBeUndefined();
    });
  });
});
