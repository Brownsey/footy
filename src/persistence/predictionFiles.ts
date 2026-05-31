import type { GroupFixture } from "@/domain/types";
import type { PickState } from "@/domain/predictionDefaults";

export interface PredictionSavePayload {
  readonly schemaVersion: 1;
  readonly app: "world-cup-2026-predictor";
  readonly exportedAt: string;
  readonly dataLastVerified: string;
  readonly picks: PickState;
}

export function buildSavePayload(
  picks: PickState,
  dataLastVerified: string,
  exportedAt = new Date().toISOString(),
): PredictionSavePayload {
  return {
    schemaVersion: 1,
    app: "world-cup-2026-predictor",
    exportedAt,
    dataLastVerified,
    picks,
  };
}

export function buildCsv(
  fixtureGroups: readonly {
    readonly group: { readonly id: string };
    readonly fixtures: readonly GroupFixture[];
  }[],
  picks: PickState,
  getTeamName: (teamId: string) => string,
  exportedAt = new Date().toISOString(),
): string {
  const rows = [
    [
      "stage",
      "group",
      "matchId",
      "teamA",
      "teamB",
      "pick",
      "teamAGoals",
      "teamBGoals",
      "timestamp",
    ],
  ];

  for (const { group, fixtures } of fixtureGroups) {
    for (const fixture of fixtures) {
      const pick = picks[fixture.id];
      rows.push([
        "Group stage",
        group.id,
        fixture.id,
        getTeamName(fixture.homeId),
        getTeamName(fixture.awayId),
        pick?.outcome ?? "",
        pick?.scoreline?.home.toString() ?? "",
        pick?.scoreline?.away.toString() ?? "",
        exportedAt,
      ]);
    }
  }

  return rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
}

export function downloadFile(
  filename: string,
  content: string,
  type: string,
): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function isSavePayload(value: unknown): value is PredictionSavePayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as {
    readonly schemaVersion?: unknown;
    readonly app?: unknown;
    readonly picks?: unknown;
  };
  return (
    candidate.schemaVersion === 1 &&
    candidate.app === "world-cup-2026-predictor" &&
    isPickState(candidate.picks)
  );
}

function escapeCsv(value: string): string {
  if (!/[",\n]/.test(value)) return value;
  return `"${value.replaceAll('"', '""')}"`;
}

function isPickState(value: unknown): value is PickState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((pick) => {
    if (!pick || typeof pick !== "object") return false;
    const candidate = pick as {
      readonly outcome?: unknown;
      readonly scoreline?: { readonly home?: unknown; readonly away?: unknown };
    };
    const outcomeOk =
      candidate.outcome === "HOME" ||
      candidate.outcome === "DRAW" ||
      candidate.outcome === "AWAY";
    const score = candidate.scoreline;
    const scoreOk =
      score === undefined ||
      (Number.isInteger(score.home) &&
        Number.isInteger(score.away) &&
        Number(score.home) >= 0 &&
        Number(score.away) >= 0);
    return outcomeOk && scoreOk;
  });
}
