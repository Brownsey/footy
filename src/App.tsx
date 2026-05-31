import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";

import { BracketBoard } from "@/components/BracketBoard";
import { ClaudePredictsPanel } from "@/components/ClaudePredictsPanel";
import { GroupCard } from "@/components/GroupCard";
import { GuardrailDialog } from "@/components/GuardrailDialog";
import { InsightRail } from "@/components/InsightRail";
import { groups, getTeam, allTeams, tournamentData } from "@/data/tournament";
import { getTeamProfile } from "@/data/teamProfiles";
import {
  pickWinner,
  resolveBracket,
  type RoundId,
  type WinnerPicks,
} from "@/domain/bracket";
import { buildEntrants } from "@/domain/bracketEntrants";
import { evaluateKnockoutPick, type Guardrail } from "@/domain/guardrails";
import { winProbability } from "@/domain/probability";
import {
  buildPredictionSets,
  type PredictionSet,
} from "@/domain/claudePredicts";
import { forecastTitleOdds } from "@/domain/forecast";
import { forecastGroup } from "@/domain/groupForecast";
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
  loadSavePayload,
  type KnockoutCsvRow,
} from "@/persistence/predictionFiles";
import { dateSlug, formatDate, formatTime } from "@/utils/format";

import "./App.css";

interface PendingPick {
  readonly matchId: string;
  readonly teamId: string;
  readonly guardrails: readonly Guardrail[];
}

/** Human-readable stage labels for the CSV knockout rows. */
const ROUND_CSV_LABEL: Readonly<Record<RoundId, string>> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarter-finals",
  SF: "Semi-finals",
  F: "Final",
};

export default function App() {
  const { tournament, lastVerified } = tournamentData;
  const [picks, setPicks] = useState<PickState>({});
  const [saveMessage, setSaveMessage] = useState("No save file loaded");
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const predictionSets = useMemo(
    () => buildPredictionSets(groups, getTeamProfile),
    [],
  );

  const fixtureGroups = useMemo(
    () =>
      groups.map((group) => ({
        group,
        fixtures: generateGroupFixtures(group),
      })),
    [],
  );

  // The forecasts depend only on static model ratings, so they are computed
  // once rather than on every pick.
  const titleRace = useMemo(
    () =>
      forecastTitleOdds(
        allTeams.map((team) => ({
          teamId: team.id,
          rating: getTeamProfile(team.id).modelRating,
        })),
      ),
    [],
  );

  const groupForecasts = useMemo(() => {
    const ratingOf = (teamId: string) => getTeamProfile(teamId).modelRating;
    return new Map(
      groups.map((group) => [group.id, forecastGroup(group, ratingOf)]),
    );
  }, []);

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

  const [winnerPicks, setWinnerPicks] = useState<WinnerPicks>({});
  const [pendingPick, setPendingPick] = useState<PendingPick | null>(null);

  const entrants = useMemo(() => buildEntrants(summaries), [summaries]);
  const bracket = useMemo(
    () => resolveBracket(entrants, winnerPicks),
    [entrants, winnerPicks],
  );

  // Keep knockout picks consistent when group results change: re-derive and drop
  // any winner that is no longer in its tie (cascade), avoiding state churn when
  // nothing actually changed.
  useEffect(() => {
    setWinnerPicks((previous) => {
      const cleaned = resolveBracket(entrants, previous).winners;
      return sameKeys(cleaned, previous) ? previous : cleaned;
    });
  }, [entrants]);

  function commitKnockoutWinner(matchId: string, teamId: string) {
    setWinnerPicks(
      (previous) => pickWinner(entrants, previous, matchId, teamId).winners,
    );
  }

  function pickKnockoutWinner(matchId: string, teamId: string) {
    const match = bracket.matches.find((entry) => entry.id === matchId);
    const opponentId = match?.homeId === teamId ? match?.awayId : match?.homeId;

    if (match && opponentId) {
      const guardrails = evaluateKnockoutPick({
        chosenId: teamId,
        chosenName: getTeam(teamId).name,
        opponentId,
        opponentName: getTeam(opponentId).name,
        winProbability: winProbability(
          getTeamProfile(teamId).modelRating,
          getTeamProfile(opponentId).modelRating,
        ),
      });
      if (guardrails.length > 0) {
        setPendingPick({ matchId, teamId, guardrails });
        return;
      }
    }

    commitKnockoutWinner(matchId, teamId);
  }

  function confirmPendingPick() {
    if (!pendingPick) return;
    commitKnockoutWinner(pendingPick.matchId, pendingPick.teamId);
    setPendingPick(null);
  }

  function applyPredictionSet(set: PredictionSet) {
    setPicks(set.picks);
    setWinnerPicks({});
    setPendingPick(null);
    setActiveTemplate(set.id);
    setSaveMessage(`Loaded "${set.name}" — edit freely`);
  }

  function setOutcome(fixture: GroupFixture, outcome: MatchOutcome) {
    const scoreline = defaultScoreline(outcome);
    setActiveTemplate(null);
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
    setActiveTemplate(null);
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
    setActiveTemplate(null);
    setWinnerPicks({});
    setPendingPick(null);
    setPicks(buildSeededPicks(fixtureGroups, getTeam));
    setSaveMessage("Seeded prediction applied");
  }

  function clearPredictions() {
    setActiveTemplate(null);
    setWinnerPicks({});
    setPendingPick(null);
    setPicks({});
    setSaveMessage("Predictions cleared");
  }

  function exportJson() {
    const exportedAt = new Date().toISOString();
    downloadFile(
      `world-cup-2026-predictions-${dateSlug()}.json`,
      JSON.stringify(
        buildSavePayload(picks, winnerPicks, lastVerified, exportedAt),
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
        knockoutCsvRows(),
      ),
      "text/csv;charset=utf-8",
    );
    setSaveMessage(`CSV exported ${formatTime(exportedAt)}`);
  }

  function knockoutCsvRows(): KnockoutCsvRow[] {
    return bracket.matches.flatMap((match) =>
      match.winnerId && match.homeId && match.awayId
        ? [
            {
              stage: ROUND_CSV_LABEL[match.round],
              matchId: match.id,
              homeId: match.homeId,
              awayId: match.awayId,
              winnerId: match.winnerId,
            },
          ]
        : [],
    );
  }

  async function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const loaded = loadSavePayload(JSON.parse(await file.text()));
      if (!loaded) {
        throw new Error("Unsupported save file");
      }
      setActiveTemplate(null);
      setPendingPick(null);
      setPicks(loaded.picks);
      setWinnerPicks(loaded.knockoutPicks);
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
            ? "All group tables are locked — the Round of 32 is populated below. Pick your way to a champion."
            : `${groups.length - completedGroups} groups still need predictions.`}
        </p>
      </section>

      <ClaudePredictsPanel
        activeId={activeTemplate}
        sets={predictionSets}
        onApply={applyPredictionSet}
      />

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
                forecast={groupForecasts.get(summary.group.id) ?? []}
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
          titleRace={titleRace}
        />
      </main>

      <section className="knockout" aria-label="Knockout bracket">
        <div className="section-heading">
          <div>
            <p className="section-heading__eyebrow">Knockout stage</p>
            <h2>Round of 32 to the Final</h2>
          </div>
          <p>
            {allGroupsComplete
              ? "Tap a team to send it through. Change an earlier tie and dependent picks clear automatically."
              : `Finish all 12 groups to unlock the bracket — ${groups.length - completedGroups} to go.`}
          </p>
        </div>

        {allGroupsComplete ? (
          <>
            {bracket.championId && (
              <div className="champion-banner" role="status">
                <span>Your champion</span>
                <strong>{getTeam(bracket.championId).name}</strong>
              </div>
            )}
            <p className="knockout__progress">
              {bracket.decided}/{bracket.total} ties decided
            </p>
            <BracketBoard bracket={bracket} onPick={pickKnockoutWinner} />
          </>
        ) : (
          <div className="knockout__locked">
            The bracket populates from the official slot map once every group
            table is final.
          </div>
        )}
      </section>

      <footer className="app-footer">
        Group model, best-thirds ranking, title-odds forecast and a cascade-safe
        knockout bracket — all driven by the cached team-knowledge layer.
      </footer>

      <GuardrailDialog
        guardrails={pendingPick?.guardrails ?? []}
        onCancel={() => setPendingPick(null)}
        onConfirm={confirmPendingPick}
      />
    </div>
  );
}

/** Shallow equality on a winner-pick map (same keys, same values). */
function sameKeys(a: WinnerPicks, b: WinnerPicks): boolean {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  return aKeys.every((key) => a[key] === b[key]);
}

function clampGoals(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(12, Math.trunc(value)));
}
