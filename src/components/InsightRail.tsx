import { TeamName } from "@/components/TeamName";
import { getTeam } from "@/data/tournament";
import type { TitleOdds } from "@/domain/forecast";
import type { RankedThird } from "@/domain/thirdPlace";
import type { GroupSummary } from "@/domain/tournamentSummary";
import { percent, signed } from "@/utils/format";

/** How many contenders the title-race panel lists. */
const TITLE_RACE_SIZE = 8;

export function InsightRail({
  allGroupsComplete,
  completedGroups,
  summaries,
  thirdQualifierIds,
  rankedThirds,
  tiebreakNeeded,
  titleRace,
}: {
  readonly allGroupsComplete: boolean;
  readonly completedGroups: number;
  readonly summaries: readonly GroupSummary[];
  readonly thirdQualifierIds: ReadonlySet<string>;
  readonly rankedThirds: readonly RankedThird[];
  readonly tiebreakNeeded: boolean;
  readonly titleRace: readonly TitleOdds[];
}) {
  return (
    <aside className="insight-rail" aria-label="Tournament insights">
      <TitleRacePanel titleRace={titleRace} />
      <QualificationPanel
        allGroupsComplete={allGroupsComplete}
        summaries={summaries}
        thirdQualifierIds={thirdQualifierIds}
      />
      <ThirdPlacePanel
        allGroupsComplete={allGroupsComplete}
        ranked={rankedThirds}
        tiebreakNeeded={tiebreakNeeded}
      />
      <BracketReadinessPanel
        allGroupsComplete={allGroupsComplete}
        completedGroups={completedGroups}
      />
    </aside>
  );
}

function TitleRacePanel({
  titleRace,
}: {
  readonly titleRace: readonly TitleOdds[];
}) {
  const contenders = titleRace.slice(0, TITLE_RACE_SIZE);
  const leadProbability = contenders[0]?.titleProbability ?? 1;

  return (
    <section className="rail-card">
      <p className="rail-card__eyebrow">Model title race</p>
      <h2>Who wins it?</h2>
      <ol className="title-race">
        {contenders.map((team) => (
          <li key={team.teamId}>
            <span className="title-race__rank">{team.rank}</span>
            <TeamName team={getTeam(team.teamId)} compact />
            <span className="title-race__bar" aria-hidden="true">
              <span
                style={{
                  width: `${(team.titleProbability / leadProbability) * 100}%`,
                }}
              />
            </span>
            <strong>{percent(team.titleProbability)}</strong>
          </li>
        ))}
      </ol>
      <p className="rail-note">
        Deterministic Elo forecast. The playable bracket uses FIFA's official
        slot map once all group tables are complete.
      </p>
    </section>
  );
}

function QualificationPanel({
  summaries,
  allGroupsComplete,
  thirdQualifierIds,
}: {
  readonly summaries: readonly GroupSummary[];
  readonly allGroupsComplete: boolean;
  readonly thirdQualifierIds: ReadonlySet<string>;
}) {
  const automatic = summaries
    .filter((summary) => summary.complete)
    .flatMap((summary) => summary.table.filter((row) => row.rank <= 2));

  const thirds = summaries
    .filter((summary) => summary.complete)
    .flatMap((summary) =>
      summary.table.filter(
        (row) => row.rank === 3 && thirdQualifierIds.has(row.teamId),
      ),
    );

  return (
    <section className="rail-card">
      <p className="rail-card__eyebrow">Qualifiers</p>
      <h2>{automatic.length + thirds.length}/32 known</h2>
      <div className="mini-meter" aria-hidden="true">
        <span
          style={{
            width: `${((automatic.length + thirds.length) / 32) * 100}%`,
          }}
        />
      </div>
      <p>
        {allGroupsComplete
          ? "The 24 automatic qualifiers and eight best thirds are ready."
          : "Complete more groups to firm up the Round of 32 pool."}
      </p>
    </section>
  );
}

function ThirdPlacePanel({
  ranked,
  allGroupsComplete,
  tiebreakNeeded,
}: {
  readonly ranked: readonly RankedThird[];
  readonly allGroupsComplete: boolean;
  readonly tiebreakNeeded: boolean;
}) {
  return (
    <section className="rail-card">
      <div className="rail-card__header">
        <div>
          <p className="rail-card__eyebrow">Best thirds</p>
          <h2>{ranked.filter((team) => team.qualified).length}/8 in range</h2>
        </div>
        <span className="status-dot" aria-hidden="true" />
      </div>

      {ranked.length === 0 ? (
        <p>Finish a group to see the third-place race.</p>
      ) : (
        <ol className="third-list">
          {ranked.map((team) => (
            <li key={`${team.groupId}-${team.teamId}`}>
              <span className="third-list__rank">{team.rank}</span>
              <TeamName team={getTeam(team.teamId)} compact />
              <span className="third-list__meta">
                {team.points} pts, {signed(team.goalDifference)},{" "}
                {team.goalsFor} GF
              </span>
              <strong>{team.qualified ? "In" : "Out"}</strong>
            </li>
          ))}
        </ol>
      )}

      {!allGroupsComplete && ranked.length > 0 && (
        <p className="rail-note">
          This list is provisional until all 12 groups finish.
        </p>
      )}
      {tiebreakNeeded && (
        <p className="rail-warning">
          The eighth-place cut is tied on modelled criteria.
        </p>
      )}
    </section>
  );
}

function BracketReadinessPanel({
  allGroupsComplete,
  completedGroups,
}: {
  readonly allGroupsComplete: boolean;
  readonly completedGroups: number;
}) {
  return (
    <section className="rail-card rail-card--bracket">
      <p className="rail-card__eyebrow">Bracket status</p>
      <h2>{allGroupsComplete ? "Seed pool ready" : "Awaiting groups"}</h2>
      <div className="round-stack" aria-label="Knockout rounds">
        {["R32", "R16", "QF", "SF", "Final"].map((round, index) => (
          <span
            className={allGroupsComplete || index === 0 ? "is-lit" : ""}
            key={round}
          >
            {round}
          </span>
        ))}
      </div>
      <p>
        {allGroupsComplete
          ? "Official FIFA Annexe C third-place allocation has populated the Round of 32."
          : `Official FIFA Annexe C allocation is wired. ${completedGroups}/12 group tables complete.`}
      </p>
    </section>
  );
}
