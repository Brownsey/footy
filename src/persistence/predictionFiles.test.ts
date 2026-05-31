import { describe, expect, it } from "vitest";

import {
  buildCsv,
  buildSavePayload,
  loadSavePayload,
  SAVE_SCHEMA_VERSION,
} from "./predictionFiles";
import type { WinnerPicks } from "@/domain/bracket";
import type { PickState } from "@/domain/predictionDefaults";
import type { GroupFixture } from "@/domain/types";

const picks: PickState = {
  "GA:a-vs-b": { outcome: "HOME", scoreline: { home: 2, away: 0 } },
};

const knockoutPicks: WinnerPicks = { "R32-0": "a" };

const fixture: GroupFixture = {
  id: "GA:a-vs-b",
  groupId: "A",
  matchday: 1,
  homeId: "a",
  awayId: "b",
};

describe("prediction file helpers", () => {
  it("builds a current-schema payload carrying group and knockout picks", () => {
    const payload = buildSavePayload(
      picks,
      knockoutPicks,
      "2026-05-31",
      "2026-05-31T12:00:00Z",
    );

    expect(payload.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(loadSavePayload(payload)).toEqual({ picks, knockoutPicks });
  });

  it("rejects unknown or malformed save payloads", () => {
    expect(loadSavePayload({ schemaVersion: 2, picks })).toBeNull();
    expect(loadSavePayload({ schemaVersion: 99, app: "x", picks })).toBeNull();
    expect(loadSavePayload(null)).toBeNull();
  });

  it("migrates a v1 file forward to an empty bracket", () => {
    const v1 = {
      schemaVersion: 1,
      app: "world-cup-2026-predictor",
      exportedAt: "2026-05-31T12:00:00Z",
      dataLastVerified: "2026-05-31",
      picks,
    };
    expect(loadSavePayload(v1)).toEqual({ picks, knockoutPicks: {} });
  });

  it("drops a non-string knockout map rather than trusting it", () => {
    const payload = {
      ...buildSavePayload(picks, {}, "2026-05-31"),
      knockoutPicks: { "R32-0": 5 },
    };
    expect(loadSavePayload(payload)).toEqual({ picks, knockoutPicks: {} });
  });

  it("exports group fixtures and decided knockout ties to CSV", () => {
    const csv = buildCsv(
      [{ group: { id: "A" }, fixtures: [fixture] }],
      picks,
      (id) => (id === "a" ? "Alpha" : "Bravo"),
      "2026-05-31T12:00:00Z",
      [
        {
          stage: "Round of 32",
          matchId: "R32-0",
          homeId: "a",
          awayId: "b",
          winnerId: "a",
        },
      ],
    );

    const lines = csv.split("\n");
    expect(lines).toHaveLength(3); // header + group + knockout
    expect(csv).toContain("Alpha,Bravo,HOME,2,0");
    expect(csv).toContain("Round of 32,,R32-0,Alpha,Bravo,HOME");
  });
});
