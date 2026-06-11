import { describe, expect, it } from "vitest";

import { getTeamProfile } from "@/data/teamProfiles";
import { allTeams, groups } from "@/data/tournament";

import { buildPredictionSets, PHILOSOPHIES } from "./claudePredicts";
import { generateGroupFixtures } from "./groupStage";

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

  it("backs the higher-rated team in every chalk fixture — no romance draws", () => {
    // Chalk's promise is that the higher-rated team always goes through, so its
    // group picks must be decisive: a draw only when the two ratings are equal.
    const chalk = sets.find((s) => s.id === "chalk")!;
    for (const group of groups) {
      for (const fixture of generateGroupFixtures(group)) {
        const pick = chalk.picks[fixture.id]!;
        const home = getTeamProfile(fixture.homeId).modelRating;
        const away = getTeamProfile(fixture.awayId).modelRating;
        const expected =
          home > away ? "HOME" : away > home ? "AWAY" : "DRAW";
        expect(pick.outcome).toBe(expected);
      }
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

  it("crowns a genuinely defensive side under the defensive lens", () => {
    const chalk = sets.find((s) => s.id === "chalk")!;
    const defensive = sets.find((s) => s.id === "defensive")!;
    // The lens must reorder away from the best side overall and land on a team
    // whose profile is actually built on its defence.
    expect(defensive.championId).not.toBe(chalk.championId);
    const profile = getTeamProfile(defensive.championId);
    const isDefensive = [...profile.strengths].some((s) =>
      /defen|organis|compact|resilien|structure|solid|disciplin/i.test(s),
    );
    expect(isDefensive).toBe(true);
  });

  it("crowns the pedigree GOAT (most World Cup titles) under the pedigree lens", () => {
    const chalk = sets.find((s) => s.id === "chalk")!;
    const pedigree = sets.find((s) => s.id === "pedigree")!;
    expect(pedigree.championId).not.toBe(chalk.championId);
    // Brazil are the record five-time champions; the title-weighted lens should
    // back them ahead of any higher-rated one-title side.
    expect(pedigree.championId).toBe("brazil");
  });

  it("backs a rank outsider under the bookies-contrarian lens", () => {
    const chalk = sets.find((s) => s.id === "chalk")!;
    const bookies = sets.find((s) => s.id === "bookies-contrarian")!;
    // The pure market fade must not crown the market favourite…
    expect(bookies.championId).not.toBe(chalk.championId);
    // …and should reach deep into the longest-priced end of the field.
    const baseRank = [...allTeams]
      .sort(
        (a, b) =>
          getTeamProfile(b.id).modelRating - getTeamProfile(a.id).modelRating,
      )
      .findIndex((team) => team.id === bookies.championId);
    expect(baseRank).toBeGreaterThanOrEqual(24);
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
