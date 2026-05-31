import type { WinnerPicks } from "@/domain/bracket";
import type { GroupFixture } from "@/domain/types";
import type { PickState } from "@/domain/predictionDefaults";

const APP_ID = "world-cup-2026-predictor";

/** Current save-file schema version (see {@link loadSavePayload} for migration). */
export const SAVE_SCHEMA_VERSION = 2;

export interface PredictionSavePayload {
  readonly schemaVersion: typeof SAVE_SCHEMA_VERSION;
  readonly app: typeof APP_ID;
  readonly exportedAt: string;
  readonly dataLastVerified: string;
  readonly picks: PickState;
  /** Knockout winner picks (match id → team id); added in schema v2. */
  readonly knockoutPicks: WinnerPicks;
}

/** The state restored from a save file, after migration. */
export interface LoadedPrediction {
  readonly picks: PickState;
  readonly knockoutPicks: WinnerPicks;
}

export function buildSavePayload(
  picks: PickState,
  knockoutPicks: WinnerPicks,
  dataLastVerified: string,
  exportedAt = new Date().toISOString(),
): PredictionSavePayload {
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    app: APP_ID,
    exportedAt,
    dataLastVerified,
    picks,
    knockoutPicks,
  };
}

/** One decided knockout tie, flattened for the CSV export. */
export interface KnockoutCsvRow {
  readonly stage: string;
  readonly matchId: string;
  readonly homeId: string;
  readonly awayId: string;
  readonly winnerId: string;
}

export function buildCsv(
  fixtureGroups: readonly {
    readonly group: { readonly id: string };
    readonly fixtures: readonly GroupFixture[];
  }[],
  picks: PickState,
  getTeamName: (teamId: string) => string,
  exportedAt = new Date().toISOString(),
  knockout: readonly KnockoutCsvRow[] = [],
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

  for (const tie of knockout) {
    rows.push([
      tie.stage,
      "",
      tie.matchId,
      getTeamName(tie.homeId),
      getTeamName(tie.awayId),
      tie.winnerId === tie.homeId ? "HOME" : "AWAY",
      "",
      "",
      exportedAt,
    ]);
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

/**
 * Validate and migrate a parsed save file into the current in-memory shape.
 *
 * Accepts every schema version this app has shipped: v1 (group picks only) and
 * v2 (adds knockout picks). Older files are migrated forward — a v1 file simply
 * restores with an empty bracket. Returns `null` for anything unrecognised.
 */
export function loadSavePayload(value: unknown): LoadedPrediction | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as {
    readonly schemaVersion?: unknown;
    readonly app?: unknown;
    readonly picks?: unknown;
    readonly knockoutPicks?: unknown;
  };

  const versionOk =
    candidate.schemaVersion === 1 || candidate.schemaVersion === 2;
  if (!versionOk || candidate.app !== APP_ID || !isPickState(candidate.picks)) {
    return null;
  }

  return {
    picks: candidate.picks,
    knockoutPicks: isKnockoutPicks(candidate.knockoutPicks)
      ? candidate.knockoutPicks
      : {},
  };
}

function escapeCsv(value: string): string {
  if (!/[",\n]/.test(value)) return value;
  return `"${value.replaceAll('"', '""')}"`;
}

function isKnockoutPicks(value: unknown): value is WinnerPicks {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((teamId) => typeof teamId === "string");
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
