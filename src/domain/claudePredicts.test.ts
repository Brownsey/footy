import { describe, expect, it } from "vitest";

import { getTeamProfile } from "@/data/teamProfiles";
import { allTeams, groups } from "@/data/tournament";

import { buildPredictionSets, PHILOSOPHIES } from "./claudePredicts";

const sets = buildPredictionSets(groups, getTeamProfile);
const teamIds = new Set(allTeams.map((team) => team.id));

describe("buildPredictionSets", () => {
  it("produces one set per declared philosophy, in order", () => {
    expect(sets.map((s) => s.id)).toEqual(PHILOSOPHIES.map((p) => p.id));
  });

  it("gives every set a full slate of group picks", () => {
    for (const set of sets) {
      expect(Object.keys(set.picks)).toHaveLength(groups.length * 6);
    }
  });

  it("projects a champion that is a real tournament team", () => {
    for (const set of sets) {
      expect(teamIds.has(set.championId)).toBe(true);
    }
  });

  it("crowns the top-rated team under the chalk philosophy", () => {
    const strongest = [...allTeams].sort(
      (a, b) =>
        getTeamProfile(b.id).modelRating - getTeamProfile(a.id).modelRating,
    )[0]!;
    const chalk = sets.find((s) => s.id === "chalk")!;
    expect(chalk.championId).toBe(strongest.id);
  });

  it("makes the contrarian set fade the chalk favourite", () => {
    const chalk = sets.find((s) => s.id === "chalk")!;
    const contrarian = sets.find((s) => s.id === "contrarian")!;
    expect(contrarian.championId).not.toBe(chalk.championId);
  });

  it("produces genuinely different sets, not ten chalk clones", () => {
    const chalk = sets.find((s) => s.id === "chalk")!;
    const underdog = sets.find((s) => s.id === "underdog")!;
    const differing = Object.keys(chalk.picks).filter(
      (id) => chalk.picks[id]?.outcome !== underdog.picks[id]?.outcome,
    );
    expect(differing.length).toBeGreaterThan(0);
  });

  it("offers several different projected champions across the ten lenses", () => {
    const distinctChampions = new Set(sets.map((s) => s.championId));
    expect(distinctChampions.size).toBeGreaterThanOrEqual(3);
  });

  it("is deterministic — identical inputs yield identical sets", () => {
    const again = buildPredictionSets(groups, getTeamProfile);
    expect(again).toEqual(sets);
  });
});
