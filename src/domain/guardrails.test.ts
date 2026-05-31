import { describe, expect, it } from "vitest";

import {
  evaluateKnockoutPick,
  LOW_PROBABILITY_THRESHOLD,
  type KnockoutPick,
} from "./guardrails";

function pick(overrides: Partial<KnockoutPick> = {}): KnockoutPick {
  return {
    chosenId: "morocco",
    chosenName: "Morocco",
    opponentId: "spain",
    opponentName: "Spain",
    winProbability: 0.4,
    ...overrides,
  };
}

describe("evaluateKnockoutPick", () => {
  it("stays silent for an unremarkable pick", () => {
    expect(evaluateKnockoutPick(pick())).toEqual([]);
  });

  it("flags a pick below the low-probability threshold", () => {
    const guardrails = evaluateKnockoutPick(
      pick({ winProbability: LOW_PROBABILITY_THRESHOLD - 0.01 }),
    );
    expect(guardrails).toHaveLength(1);
    expect(guardrails[0]?.kind).toBe("low-probability");
    expect(guardrails[0]?.message).toContain("14%");
  });

  it("does not flag a pick exactly at the threshold", () => {
    const guardrails = evaluateKnockoutPick(
      pick({ winProbability: LOW_PROBABILITY_THRESHOLD }),
    );
    expect(guardrails.every((g) => g.kind !== "low-probability")).toBe(true);
  });

  it("fires the UK easter egg for Germany over England", () => {
    const guardrails = evaluateKnockoutPick(
      pick({
        chosenId: "germany",
        chosenName: "Germany",
        opponentId: "england",
        opponentName: "England",
        winProbability: 0.5,
      }),
    );
    expect(guardrails.map((g) => g.kind)).toEqual(["uk-easter-egg"]);
  });

  it("fires the UK easter egg for France over Scotland", () => {
    const guardrails = evaluateKnockoutPick(
      pick({
        chosenId: "france",
        chosenName: "France",
        opponentId: "scotland",
        opponentName: "Scotland",
        winProbability: 0.7,
      }),
    );
    expect(guardrails.map((g) => g.kind)).toEqual(["uk-easter-egg"]);
  });

  it("does not fire when a UK side wins, only when it loses to the nemesis", () => {
    const guardrails = evaluateKnockoutPick(
      pick({
        chosenId: "england",
        chosenName: "England",
        opponentId: "germany",
        opponentName: "Germany",
        winProbability: 0.5,
      }),
    );
    expect(guardrails).toEqual([]);
  });

  it("can raise both guardrails at once, low-probability first", () => {
    const guardrails = evaluateKnockoutPick(
      pick({
        chosenId: "germany",
        chosenName: "Germany",
        opponentId: "england",
        opponentName: "England",
        winProbability: 0.1,
      }),
    );
    expect(guardrails.map((g) => g.kind)).toEqual([
      "low-probability",
      "uk-easter-egg",
    ]);
  });
});
