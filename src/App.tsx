import { useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";

import { GroupCard } from "@/components/GroupCard";
import { InsightRail } from "@/components/InsightRail";
import { groups, getTeam, tournamentData } from "@/data/tournament";
import {
  computeStandings,
  generateGroupFixtures,
  isGroupComplete,
  scorelineToOutcome,
} from "@/domain/groupStage";
import {
  buildSeededPicks,
  defaultScoreline,
  type PickState,
} from "@/domain/predictionDefaults";
import { rankThirdPlacedTeams, thirdPlacedOf } from "@/domain/thirdPlace";
import type { GroupFixture, MatchOutcome, Scoreline } from "@/domain/types";
import type { GroupSummary } from "@/domain/tournamentSummary";
import {
  buildCsv,
  buildSavePayload,
  downloadFile,
  isSavePayload,
} from "@/persistence/predictionFiles";
import { dateSlug, formatDate, formatTime } from "@/utils/format";

import "./App.css";

export default function App() {
  const { tournament, lastVerified } = tournamentData;
  const [picks, setPicks] = useState<PickState>({});
  const [saveMessage, setSaveMessage] = useState("No save file loaded");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fixtureGroups = useMemo(
    () =>
      groups.map((group) => ({
        group,
        fixtures: generateGroupFixtures(group),
      })),
    [],
  );

  const summaries = useMemo<GroupSummary[]>(
    () =>
      fixtureGroups.map(({ group, fixtures }) => {
        const table = computeStandings(group, fixtures, picks);
        return {
          group,
          fixtures,
          table,
          picked: fixtures.filter((fixture) => picks[fixture.id]).length,
          complete: isGroupComplete(fixtures, picks),
        };
      }),
    [fixtureGroups, picks],
  );

  const totalFixtures = fixtureGroups.reduce(
    (total, group) => total + group.fixtures.length,
    0,
  );
  const pickedFixtures = Object.keys(picks).length;
  const completedGroups = summaries.filter(
    (summary) => summary.complete,
  ).length;
  const allGroupsComplete = completedGroups === groups.length;
  const completionPercent = Math.round((pickedFixtures / totalFixtures) * 100);

  const thirdRanking = useMemo(() => {
    const completedThirds = summaries
      .filter((summary) => summary.complete)
      .map((summary) => thirdPlacedOf(summary.group.id, summary.table));
    return rankThirdPlacedTeams(completedThirds);
  }, [summaries]);

  const qualifiedThirdIds = new Set(
    thirdRanking.qualifiers.map((team) => team.teamId),
  );

  function setOutcome(fixture: GroupFixture, outcome: MatchOutcome) {
    const scoreline = defaultScoreline(outcome);
    setPicks((current) => ({
      ...current,
      [fixture.id]: { outcome, scoreline },
    }));
  }

  function setScore(
    fixture: GroupFixture,
    side: keyof Scoreline,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const goals = clampGoals(event.target.valueAsNumber);
    setPicks((current) => {
      const existing = current[fixture.id];
      const scoreline = existing?.scoreline ?? { home: 0, away: 0 };
      const nextScoreline = { ...scoreline, [side]: goals };
      return {
        ...current,
        [fixture.id]: {
          outcome: scorelineToOutcome(nextScoreline),
          scoreline: nextScoreline,
        },
      };
    });
  }

  function applySeededPrediction() {
    setPicks(buildSeededPicks(fixtureGroups, getTeam));
    setSaveMessage("Seeded prediction applied");
  }

  function clearPredictions() {
    setPicks({});
    setSaveMessage("Predictions cleared");
  }

  function exportJson() {
    const exportedAt = new Date().toISOString();
    downloadFile(
      `world-cup-2026-predictions-${dateSlug()}.json`,
      JSON.stringify(
        buildSavePayload(picks, lastVerified, exportedAt),
        null,
        2,
      ),
      "application/json",
    );
    setSaveMessage(`JSON exported ${formatTime(exportedAt)}`);
  }

  function exportCsv() {
    const exportedAt = new Date().toISOString();

    downloadFile(
      `world-cup-2026-predictions-${dateSlug()}.csv`,
      buildCsv(
        fixtureGroups,
        picks,
        (teamId) => getTeam(teamId).name,
        exportedAt,
      ),
      "text/csv;charset=utf-8",
    );
    setSaveMessage(`CSV exported ${formatTime(exportedAt)}`);
  }

  async function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const payload: unknown = JSON.parse(await file.text());
      if (!isSavePayload(payload)) {
        throw new Error("Unsupported save file");
      }
      setPicks(payload.picks);
      setSaveMessage(`Loaded ${file.name}`);
    } catch {
      setSaveMessage("Import failed: choose a valid JSON export");
    } finally {
      event.target.value = "";
    }
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero__copy">
          <p className="hero__eyebrow">
            {formatDate(tournament.startDate)} to{" "}
            {formatDate(tournament.endDate)}
            {" / "}
            {tournament.hosts.join(", ")}
          </p>
          <h1>{tournament.name} Predictor</h1>
          <p className="hero__lede">
            Predict neutral-site group fixtures by tapping a team or draw,
            refine the scoreline, and watch the live tables and best-third race
            update instantly.
          </p>
          <div className="hero__actions" aria-label="Prediction shortcuts">
            <button
              className="button button--primary"
              onClick={applySeededPrediction}
            >
              Seed smart picks
            </button>
            <button
              className="button button--ghost"
              disabled={pickedFixtures === 0}
              onClick={exportJson}
            >
              Export JSON
            </button>
            <button
              className="button button--ghost"
              disabled={pickedFixtures === 0}
              onClick={exportCsv}
            >
              Export CSV
            </button>
            <button
              className="button button--ghost"
              onClick={() => fileInputRef.current?.click()}
            >
              Import JSON
            </button>
            <button
              className="button button--ghost"
              disabled={pickedFixtures === 0}
              onClick={clearPredictions}
            >
              Clear picks
            </button>
            <input
              ref={fileInputRef}
              accept="application/json,.json"
              className="file-input"
              onChange={(event) => void importJson(event)}
              type="file"
            />
          </div>
          <p className="save-status" role="status">
            {saveMessage}
          </p>
        </div>

        <div className="hero__panel" aria-label="Tournament status">
          <div>
            <span className="metric__label">Format</span>
            <strong>{tournament.teamCount} teams</strong>
            <span>12 groups, Round of 32</span>
          </div>
          <div>
            <span className="metric__label">Progress</span>
            <strong>
              {completedGroups}/{tournament.groupCount} groups
            </strong>
            <span>
              {pickedFixtures}/{totalFixtures} fixtures predicted
            </span>
          </div>
          <div>
            <span className="metric__label">Data</span>
            <strong>Verified {lastVerified}</strong>
            <span>{tournament.totalMatches} matches total</span>
          </div>
        </div>
      </header>

      <section className="progress-dock" aria-label="Prediction progress">
        <div>
          <span className="progress-dock__label">Group stage completion</span>
          <strong>{completionPercent}%</strong>
        </div>
        <div className="progress-track" aria-hidden="true">
          <span style={{ width: `${completionPercent}%` }} />
        </div>
        <p>
          {allGroupsComplete
            ? "All group tables are locked. Official R32 slot allocation can be wired next."
            : `${groups.length - completedGroups} groups still need predictions.`}
        </p>
      </section>

      <main className="workspace">
        <section className="groups-panel" aria-label="Group predictions">
          <div className="section-heading">
            <div>
              <p className="section-heading__eyebrow">Group stage</p>
              <h2>Predict the 72 opening fixtures</h2>
            </div>
            <p>
              Fixtures are neutral-site tournament matches. The left and right
              sides are scheduling order, not home and away teams.
            </p>
          </div>

          <div className="group-grid">
            {summaries.map((summary) => (
              <GroupCard
                key={summary.group.id}
                picks={picks}
                qualifiedThirdIds={qualifiedThirdIds}
                summary={summary}
                onScoreChange={setScore}
                onOutcomeChange={setOutcome}
              />
            ))}
          </div>
        </section>

        <InsightRail
          allGroupsComplete={allGroupsComplete}
          completedGroups={completedGroups}
          rankedThirds={thirdRanking.ranked}
          summaries={summaries}
          thirdQualifierIds={qualifiedThirdIds}
          tiebreakNeeded={thirdRanking.tiebreakNeeded}
        />
      </main>

      <footer className="app-footer">
        Official Round of 32 third-place slot allocation remains the next data
        layer before full knockout winner picking.
      </footer>
    </div>
  );
}

function clampGoals(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(12, Math.trunc(value)));
}
