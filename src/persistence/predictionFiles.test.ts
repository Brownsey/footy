import { describe, expect, it } from "vitest";

import { buildCsv, buildSavePayload, isSavePayload } from "./predictionFiles";
import type { PickState } from "@/domain/predictionDefaults";
import type { GroupFixture } from "@/domain/types";

const picks: PickState = {
  "GA:a-vs-b": { outcome: "HOME", scoreline: { home: 2, away: 0 } },
};

const fixture: GroupFixture = {
  id: "GA:a-vs-b",
  groupId: "A",
  matchday: 1,
  homeId: "a",
  awayId: "b",
};

describe("prediction file helpers", () => {
  it("builds and validates a schema-versioned save payload", () => {
    const payload = buildSavePayload(
      picks,
      "2026-05-31",
      "2026-05-31T12:00:00Z",
    );

    expect(isSavePayload(payload)).toBe(true);
    expect(payload.picks).toBe(picks);
  });

  it("rejects unknown save payloads", () => {
    expect(isSavePayload({ schemaVersion: 1, picks })).toBe(false);
    expect(
      isSavePayload({
        schemaVersion: 2,
        app: "world-cup-2026-predictor",
        picks,
      }),
    ).toBe(false);
  });

  it("exports one CSV row per fixture", () => {
    const csv = buildCsv(
      [{ group: { id: "A" }, fixtures: [fixture] }],
      picks,
      (id) => (id === "a" ? "Alpha" : "Bravo"),
      "2026-05-31T12:00:00Z",
    );

    expect(csv.split("\n")).toHaveLength(2);
    expect(csv).toContain("Alpha,Bravo,HOME,2,0");
  });
});
