import { describe, expect, it } from "vitest";

import {
  drawProbability,
  expectedScore,
  matchProbabilities,
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
