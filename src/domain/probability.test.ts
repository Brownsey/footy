import { describe, expect, it } from "vitest";

import {
  drawProbability,
  expectedScore,
  matchProbabilities,
  mostLikelyScoreline,
  projectedGoals,
  winProbability,
} from "./probability";

describe("expectedScore", () => {
  it("is 0.5 for equal ratings", () => {
    expect(expectedScore(1800, 1800)).toBeCloseTo(0.5, 10);
  });

  it("rises with a positive rating gap and is symmetric", () => {
    const favoured = expectedScore(1900, 1500);
    expect(favoured).toBeGreaterThan(0.5);
    expect(favoured + expectedScore(1500, 1900)).toBeCloseTo(1, 10);
  });

  it("gives a 400-point edge ~10:1 odds (≈0.909)", () => {
    expect(expectedScore(1900, 1500)).toBeCloseTo(10 / 11, 6);
  });

  it("aliases winProbability", () => {
    expect(winProbability).toBe(expectedScore);
  });
});

describe("drawProbability", () => {
  it("is highest for level teams and lowest for mismatches", () => {
    expect(drawProbability(0)).toBeGreaterThan(drawProbability(400));
  });

  it("stays inside the documented band", () => {
    for (const delta of [-1000, -200, 0, 200, 1000]) {
      const draw = drawProbability(delta);
      expect(draw).toBeGreaterThanOrEqual(0.12);
      expect(draw).toBeLessThanOrEqual(0.3);
    }
  });
});

describe("matchProbabilities", () => {
  it("returns a normalised win/draw/loss split", () => {
    const probs = matchProbabilities(1820, 1680);
    expect(probs.home + probs.draw + probs.away).toBeCloseTo(1, 10);
    expect(probs.home).toBeGreaterThan(probs.away);
  });

  it("is mirror-symmetric when the sides swap", () => {
    const ab = matchProbabilities(1820, 1680);
    const ba = matchProbabilities(1680, 1820);
    expect(ab.home).toBeCloseTo(ba.away, 10);
    expect(ab.draw).toBeCloseTo(ba.draw, 10);
  });
});

describe("projectedGoals", () => {
  it("splits ~2.6 goals evenly for level sides", () => {
    const goals = projectedGoals(1800, 1800);
    expect(goals.home).toBeCloseTo(1.3, 10);
    expect(goals.away).toBeCloseTo(1.3, 10);
  });

  it("raises the favourite and lowers the underdog", () => {
    const goals = projectedGoals(1950, 1600);
    expect(goals.home).toBeGreaterThan(goals.away);
    expect(goals.away).toBeGreaterThanOrEqual(0.25);
  });
});

describe("mostLikelyScoreline", () => {
  it("does not default a modest home favourite to 2–1", () => {
    // A small edge realises as the modal low-scoring win, 1–0 — not a flat 2–1.
    const score = mostLikelyScoreline(1820, 1760, "HOME");
    expect(score).toEqual({ home: 1, away: 0 });
  });

  it("scales the margin with supremacy", () => {
    const clear = mostLikelyScoreline(2000, 1650, "HOME");
    const heavy = mostLikelyScoreline(2100, 1500, "HOME");
    expect(clear.home).toBeGreaterThanOrEqual(2);
    expect(clear.home).toBeGreaterThan(clear.away);
    expect(heavy.home - heavy.away).toBeGreaterThanOrEqual(clear.home - clear.away);
  });

  it("always agrees with the requested outcome", () => {
    expect(mostLikelyScoreline(1700, 1900, "AWAY").away).toBeGreaterThan(
      mostLikelyScoreline(1700, 1900, "AWAY").home,
    );
    const draw = mostLikelyScoreline(2000, 1500, "DRAW");
    expect(draw.home).toBe(draw.away);
  });

  it("mirrors when the sides swap", () => {
    const home = mostLikelyScoreline(1900, 1700, "HOME");
    const away = mostLikelyScoreline(1700, 1900, "AWAY");
    expect(home.home).toBe(away.away);
    expect(home.away).toBe(away.home);
  });

  it("produces a varied, realistic spread rather than one default", () => {
    const ratings = [2050, 1980, 1900, 1850, 1800, 1750, 1700, 1620, 1550];
    const scores = new Set<string>();
    for (const a of ratings) {
      for (const b of ratings) {
        if (a <= b) continue;
        const s = mostLikelyScoreline(a, b, "HOME");
        scores.add(`${s.home}-${s.away}`);
      }
    }
    // The old flat default produced a single scoreline; the model spreads them
    // across at least 1–0 and a wider margin as supremacy grows.
    expect(scores.size).toBeGreaterThanOrEqual(2);
    expect(scores.has("1-0")).toBe(true);
  });
});
