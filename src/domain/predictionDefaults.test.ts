import { describe, expect, it } from "vitest";

import {
  buildSeededPicks,
  modelOutcome,
  modelScoreline,
} from "./predictionDefaults";
import type { GroupFixture } from "./types";

describe("prediction defaults", () => {
  it("picks the outcome from the rating gap", () => {
    expect(modelOutcome(1950, 1600)).toBe("HOME");
    expect(modelOutcome(1600, 1950)).toBe("AWAY");
    expect(modelOutcome(1800, 1800)).toBe("DRAW");
  });

  it("fills a model scoreline that agrees with the outcome", () => {
    const home = modelScoreline(1900, 1750, "HOME");
    expect(home.home).toBeGreaterThan(home.away);
    const draw = modelScoreline(1900, 1750, "DRAW");
    expect(draw.home).toBe(draw.away);
  });

  it("samples a varied, outcome-consistent spread — not one flat scoreline", () => {
    // Across a range of favourites the sampled scorelines vary (1–0, 2–1, 2–0,
    // 3–0, …) instead of collapsing to a single default; each agrees with HOME.
    const scores = new Set<string>();
    for (const [a, b] of [
      [1820, 1760],
      [1900, 1700],
      [1950, 1600],
      [1980, 1500],
      [2000, 1480],
    ] as const) {
      const s = modelScoreline(a, b, "HOME");
      expect(s.home).toBeGreaterThan(s.away);
      scores.add(`${s.home}-${s.away}`);
    }
    expect(scores.size).toBeGreaterThan(1);
  });

  it("is deterministic — same ratings yield the same sampled scoreline", () => {
    expect(modelScoreline(1900, 1700, "HOME")).toEqual(
      modelScoreline(1900, 1700, "HOME"),
    );
  });

  it("seeds near-level ties as draws but not clear favourites", () => {
    // A slim edge is most defensibly a draw (restores realistic draw rate)…
    expect(modelOutcome(1810, 1790)).toBe("DRAW");
    // …while a clear edge stays decisive.
    expect(modelOutcome(1900, 1700)).toBe("HOME");
  });

  it("builds a model pick for every provided fixture", () => {
    const fixture: GroupFixture = {
      id: "GZ:a-vs-b",
      groupId: "A",
      matchday: 1,
      homeId: "a",
      awayId: "b",
    };
    const ratings: Record<string, number> = { a: 2000, b: 1550 };
    const picks = buildSeededPicks([{ fixtures: [fixture] }], (id) => ratings[id] ?? 1700);

    expect(picks[fixture.id]?.outcome).toBe("HOME");
    const scoreline = picks[fixture.id]?.scoreline;
    expect(scoreline?.home).toBeGreaterThan(scoreline?.away ?? 0);
  });
});
