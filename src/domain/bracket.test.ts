import { describe, expect, it } from "vitest";

import {
  BRACKET_ENTRANTS,
  clearWinner,
  matchId,
  pickWinner,
  resolveBracket,
  type WinnerPicks,
} from "./bracket";

/** 32 entrants named t0…t31, in bracket order. */
const entrants = Array.from({ length: BRACKET_ENTRANTS }, (_, i) => `t${i}`);

/** Pick the home (lower-seeded index) team in every tie of a resolved bracket. */
function pickAllHome(
  start: ReturnType<typeof resolveBracket>,
): ReturnType<typeof resolveBracket> {
  let bracket = start;
  let picks: WinnerPicks = bracket.winners;
  // Iterate rounds in order so each round's entrants are known before picking.
  for (const round of ["R32", "R16", "QF", "SF", "F"] as const) {
    for (const match of bracket.rounds.get(round) ?? []) {
      if (match.homeId === undefined) continue;
      picks = { ...picks, [match.id]: match.homeId };
    }
    bracket = resolveBracket(entrants, picks);
  }
  return bracket;
}

describe("resolveBracket", () => {
  it("builds a 31-tie tree across the five rounds", () => {
    const bracket = resolveBracket(entrants, {});
    expect(bracket.total).toBe(31);
    expect(bracket.rounds.get("R32")).toHaveLength(16);
    expect(bracket.rounds.get("R16")).toHaveLength(8);
    expect(bracket.rounds.get("QF")).toHaveLength(4);
    expect(bracket.rounds.get("SF")).toHaveLength(2);
    expect(bracket.rounds.get("F")).toHaveLength(1);
  });

  it("seeds the 32 entrants into the R32 ties in order", () => {
    const r32 = resolveBracket(entrants, {}).rounds.get("R32") ?? [];
    expect(r32[0]).toMatchObject({ homeId: "t0", awayId: "t1" });
    expect(r32[15]).toMatchObject({ homeId: "t30", awayId: "t31" });
  });

  it("leaves later rounds empty until feeders are decided", () => {
    const bracket = resolveBracket(entrants, {});
    expect(bracket.rounds.get("R16")?.[0]).toMatchObject({
      homeId: undefined,
      awayId: undefined,
    });
    expect(bracket.championId).toBeUndefined();
  });
});

describe("pickWinner", () => {
  it("promotes a winner into the correct slot of the next round", () => {
    const first = pickWinner(entrants, {}, matchId("R32", 0), "t0");
    expect(first.rounds.get("R16")?.[0]?.homeId).toBe("t0");

    const second = pickWinner(entrants, first.winners, matchId("R32", 1), "t3");
    expect(second.rounds.get("R16")?.[0]?.awayId).toBe("t3");
  });

  it("ignores a winner that is not in the tie", () => {
    const bracket = pickWinner(entrants, {}, matchId("R32", 0), "t9");
    expect(bracket.rounds.get("R32")?.[0]?.winnerId).toBeUndefined();
    expect(bracket.decided).toBe(0);
  });

  it("crowns a champion when every tie is decided", () => {
    const bracket = pickAllHome(resolveBracket(entrants, {}));
    expect(bracket.decided).toBe(31);
    expect(bracket.championId).toBe("t0");
  });
});

describe("cascade invalidation", () => {
  it("drops a downstream pick when its feeder winner changes", () => {
    // t0 wins R32-0, then t0 wins R16-0.
    let bracket = pickWinner(entrants, {}, matchId("R32", 0), "t0");
    bracket = pickWinner(entrants, bracket.winners, matchId("R16", 0), "t0");
    expect(bracket.rounds.get("R16")?.[0]?.winnerId).toBe("t0");

    // Change R32-0 so t1 advances instead: the R16-0 pick for t0 is now invalid.
    bracket = pickWinner(entrants, bracket.winners, matchId("R32", 0), "t1");
    expect(bracket.rounds.get("R16")?.[0]?.homeId).toBe("t1");
    expect(bracket.rounds.get("R16")?.[0]?.winnerId).toBeUndefined();
    expect(bracket.winners[matchId("R16", 0)]).toBeUndefined();
  });

  it("cascades through multiple rounds", () => {
    let bracket = pickAllHome(resolveBracket(entrants, {}));
    expect(bracket.championId).toBe("t0");

    // Flip the very first tie; the whole t0 spine should unwind.
    bracket = pickWinner(entrants, bracket.winners, matchId("R32", 0), "t1");
    expect(bracket.championId).toBeUndefined();
    expect(bracket.rounds.get("R16")?.[0]?.winnerId).toBeUndefined();
    expect(bracket.rounds.get("QF")?.[0]?.winnerId).toBeUndefined();
  });

  it("preserves unrelated picks when one tie changes", () => {
    let bracket = pickAllHome(resolveBracket(entrants, {}));
    // Change a tie on the far side of the bracket.
    bracket = pickWinner(entrants, bracket.winners, matchId("R32", 15), "t31");
    // The opposite half's R16 tie is untouched.
    expect(bracket.rounds.get("R16")?.[0]?.winnerId).toBe("t0");
  });
});

describe("clearWinner", () => {
  it("removes a pick and anything that depended on it", () => {
    let bracket = pickAllHome(resolveBracket(entrants, {}));
    bracket = clearWinner(entrants, bracket.winners, matchId("R32", 0));
    expect(bracket.rounds.get("R32")?.[0]?.winnerId).toBeUndefined();
    expect(bracket.championId).toBeUndefined();
  });
});
