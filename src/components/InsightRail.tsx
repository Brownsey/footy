import { TeamName } from "@/components/TeamName";
import { getTeam } from "@/data/tournament";
import type { GoldenBootOdds } from "@/domain/goldenBoot";
import type { RankedThird } from "@/domain/thirdPlace";
import type { GroupSummary } from "@/domain/tournamentSummary";
import { percent, signed } from "@/utils/format";

/** How many contenders the title-race panel lists. */
const TITLE_RACE_SIZE = 8;
/** How many players the Golden Boot panel lists. */
const GOLDEN_BOOT_SIZE = 6;

/**
 * A title-race row. Always carries a champion probability and rank; the
 * stage-by-stage "road to the final" fields are present only once the
 * Monte-Carlo simulation has run (the instant neutral forecast omits them).
 */
export interface TitleRaceEntry {
  readonly teamId: string;
  readonly titleProbability: number;
  readonly rank: number;
  readonly pReachR16?: number;
  readonly pReachQuarter?: number;
  readonly pReachSemi?: number;
  readonly pReachFinal?: number;
}

export function InsightRail({
  allGroupsComplete,
  completedGroups,
  summaries,
  thirdQualifierIds,
  rankedThirds,
  tiebreakNeeded,
  titleRace,
  goldenBoot,
}: {
  readonly allGroupsComplete: boolean;
  readonly completedGroups: number;
  readonly summaries: readonly GroupSummary[];
  readonly thirdQualifierIds: ReadonlySet<string>;
  readonly rankedThirds: readonly RankedThird[];
  readonly tiebreakNeeded: boolean;
  readonly titleRace: readonly TitleRaceEntry[];
  readonly goldenBoot: readonly GoldenBootOdds[];
}) {
  return (
    <aside className="insight-rail" aria-label="Tournament insights">
      <TitleRacePanel titleRace={titleRace} />
      <GoldenBootPanel goldenBoot={goldenBoot} />
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
  readonly titleRace: readonly TitleRaceEntry[];
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
            {team.pReachFinal !== undefined && (
              <span className="title-race__road">
                R16 {percent(team.pReachR16 ?? 0)} · QF{" "}
                {percent(team.pReachQuarter ?? 0)} · SF{" "}
                {percent(team.pReachSemi ?? 0)} · F {percent(team.pReachFinal)}
              </span>
            )}
          </li>
        ))}
      </ol>
      <p className="rail-note">
        Draw-aware forecast from 5,000 simulated tournaments through the real
        bracket. The playable bracket uses FIFA's official slot map once all
        group tables are complete.
      </p>
    </section>
  );
}

function GoldenBootPanel({
  goldenBoot,
}: {
  readonly goldenBoot: readonly GoldenBootOdds[];
}) {
  if (goldenBoot.length === 0) return null;
  const contenders = goldenBoot.slice(0, GOLDEN_BOOT_SIZE);
  const lead = contenders[0]?.winProbability ?? 1;

  return (
    <section className="rail-card">
      <p className="rail-card__eyebrow">Golden Boot race</p>
      <h2>Top scorer?</h2>
      <ol className="title-race">
        {contenders.map((player) => (
          <li key={player.name}>
            <span className="title-race__rank">{player.rank}</span>
            <span className="golden-boot__player">
              {player.name}
              <small>
                <TeamName team={getTeam(player.teamId)} compact /> ·{" "}
                {player.expectedGoals.toFixed(1)} xG
              </small>
            </span>
            <span className="title-race__bar" aria-hidden="true">
              <span
                style={{ width: `${(player.winProbability / lead) * 100}%` }}
              />
            </span>
            <strong>{percent(player.winProbability)}</strong>
          </li>
        ))}
      </ol>
      <p className="rail-note">
        Each player's goals are simulated from his scoring rate × the games the
        model expects his team to play; the bar is his share of finishing top
        scorer among these contenders.
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
