import type { Group, GroupFixture, StandingRow } from "./types";

export interface GroupSummary {
  readonly group: Group;
  readonly fixtures: readonly GroupFixture[];
  readonly table: readonly StandingRow[];
  readonly picked: number;
  readonly complete: boolean;
}
