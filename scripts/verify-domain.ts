/**
 * Dependency-free smoke test for the pure domain logic.
 *
 * The project's real tests run under Vitest, but Vitest needs an `npm install`
 * which is unavailable in this offline environment. Node 22 can execute
 * TypeScript directly via type-stripping, and ships a built-in test runner, so
 * this harness exercises the same `src/domain` modules with zero dependencies:
 *
 *   node --experimental-strip-types --test scripts/verify-domain.ts
 *
 * It is a stop-gap verification, not a replacement for the Vitest suite.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  computeStandings,
  fixtureId,
  generateGroupFixtures,
  isGroupComplete,
  outcomeToScoreline,
  scorelineToOutcome,
} from "../src/domain/groupStage.ts";
import type { Group, GroupPick, Team } from "../src/domain/types.ts";

function team(id: string, pot: 1 | 2 | 3 | 4): Team {
  return { id, name: id, confederation: "UEFA", flag: "xx", pot };
}

const GROUP: Group = {
  id: "A",
  teams: [team("alpha", 1), team("bravo", 2), team("charlie", 3), team("delta", 4)],
};
const FIXTURES = generateGroupFixtures(GROUP);

void test("six fixtures, each team plays three", () => {
  assert.equal(FIXTURES.length, 6);
  const appearances = new Map<string, number>();
  for (const f of FIXTURES) {
    appearances.set(f.homeId, (appearances.get(f.homeId) ?? 0) + 1);
    appearances.set(f.awayId, (appearances.get(f.awayId) ?? 0) + 1);
  }
  assert.deepEqual([...appearances.values()], [3, 3, 3, 3]);
});

void test("every pair meets exactly once", () => {
  const pairs = FIXTURES.map((f) => [f.homeId, f.awayId].sort().join("|"));
  assert.equal(new Set(pairs).size, 6);
});

void test("outcome <-> scoreline round-trip", () => {
  assert.deepEqual(outcomeToScoreline("HOME"), { home: 1, away: 0 });
  assert.deepEqual(outcomeToScoreline("DRAW"), { home: 0, away: 0 });
  assert.equal(scorelineToOutcome({ home: 3, away: 1 }), "HOME");
  assert.equal(scorelineToOutcome({ home: 1, away: 1 }), "DRAW");
});

void test("points: 3 for a win, 1 for a draw", () => {
  const picks: Record<string, GroupPick> = {
    [fixtureId("A", "alpha", "bravo")]: { outcome: "HOME" },
    [fixtureId("A", "charlie", "delta")]: { outcome: "DRAW" },
  };
  const table = computeStandings(GROUP, FIXTURES, picks);
  const byId = Object.fromEntries(table.map((r) => [r.teamId, r]));
  assert.equal(byId.alpha.points, 3);
  assert.equal(byId.bravo.points, 0);
  assert.equal(byId.charlie.points, 1);
  assert.equal(byId.delta.points, 1);
});

void test("ranking + tiebreak on goal difference", () => {
  const picks: Record<string, GroupPick> = {
    [fixtureId("A", "alpha", "bravo")]: {
      outcome: "HOME",
      scoreline: { home: 5, away: 0 },
    },
    [fixtureId("A", "charlie", "delta")]: {
      outcome: "HOME",
      scoreline: { home: 1, away: 0 },
    },
  };
  const table = computeStandings(GROUP, FIXTURES, picks);
  assert.equal(table[0].teamId, "alpha");
  assert.equal(table[1].teamId, "charlie");
  assert.equal(table.map((r) => r.rank).join(","), "1,2,3,4");
});

void test("completeness flips only when all six picks exist", () => {
  assert.equal(isGroupComplete(FIXTURES, {}), false);
  const full = Object.fromEntries(
    FIXTURES.map((f): [string, GroupPick] => [f.id, { outcome: "HOME" }]),
  );
  assert.equal(isGroupComplete(FIXTURES, full), true);
});
