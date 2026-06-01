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

  it("gives every set a full knockout bracket (31 ties: R32→Final)", () => {
    for (const set of sets) {
      expect(Object.keys(set.knockoutPicks)).toHaveLength(31);
    }
  });

  it("crowns the team that actually wins its own bracket final", () => {
    // The projected winner must be reachable from the loaded picks: it is the
    // winner of the official final (M104), not a guess from a neutral seeding.
    for (const set of sets) {
      expect(set.knockoutPicks["M104"]).toBe(set.championId);
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

  it("crowns a genuine dark horse under the underdog lens, not the top seed", () => {
    const chalk = sets.find((s) => s.id === "chalk")!;
    const underdog = sets.find((s) => s.id === "underdog")!;
    expect(underdog.championId).not.toBe(chalk.championId);

    // The underdog champion should sit outside the top few by base rating.
    const baseRank = [...allTeams]
      .sort(
        (a, b) => getTeamProfile(b.id).modelRating - getTeamProfile(a.id).modelRating,
      )
      .findIndex((team) => team.id === underdog.championId);
    expect(baseRank).toBeGreaterThanOrEqual(4);
  });

  it("produces genuinely different sets, not ten chalk clones", () => {
    const chalk = sets.find((s) => s.id === "chalk")!;
    const underdog = sets.find((s) => s.id === "underdog")!;
    const differing = Object.keys(chalk.picks).filter(
      (id) => chalk.picks[id]?.outcome !== underdog.picks[id]?.outcome,
    );
    expect(differing.length).toBeGreaterThan(0);
  });

  it("crowns a host nation under the host-advantage lens", () => {
    const hostIds = new Set(
      allTeams.filter((team) => team.host).map((team) => team.id),
    );
    const host = sets.find((s) => s.id === "host")!;
    expect(hostIds.has(host.championId)).toBe(true);
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
