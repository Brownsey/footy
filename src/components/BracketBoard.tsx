import { TeamName } from "@/components/TeamName";
import { getTeam } from "@/data/tournament";
import { getTeamProfile } from "@/data/teamProfiles";
import {
  ROUNDS,
  type BracketMatch,
  type ResolvedBracket,
  type RoundId,
} from "@/domain/bracket";
import { winProbability } from "@/domain/probability";
import type { TeamId } from "@/domain/types";
import { percent } from "@/utils/format";

const ROUND_LABEL: Readonly<Record<RoundId, string>> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarter-finals",
  SF: "Semi-finals",
  F: "Final",
};

export function BracketBoard({
  bracket,
  onPick,
}: {
  readonly bracket: ResolvedBracket;
  readonly onPick: (matchId: string, teamId: TeamId) => void;
}) {
  return (
    <div className="bracket">
      <div className="bracket__scroller">
        {ROUNDS.map(({ id }) => (
          <section
            className="bracket__round"
            key={id}
            aria-label={ROUND_LABEL[id]}
          >
            <h3 className="bracket__round-title">{ROUND_LABEL[id]}</h3>
            <div className="bracket__matches">
              {(bracket.rounds.get(id) ?? []).map((match) => (
                <MatchCard key={match.id} match={match} onPick={onPick} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function MatchCard({
  match,
  onPick,
}: {
  readonly match: BracketMatch;
  readonly onPick: (matchId: string, teamId: TeamId) => void;
}) {
  const probabilities = winProbabilities(match.homeId, match.awayId);
  return (
    <div className="bracket-match">
      <SideButton
        matchId={match.id}
        probability={probabilities?.home}
        selected={match.winnerId === match.homeId}
        teamId={match.homeId}
        winnerChosen={match.winnerId !== undefined}
        onPick={onPick}
      />
      <SideButton
        matchId={match.id}
        probability={probabilities?.away}
        selected={match.winnerId === match.awayId}
        teamId={match.awayId}
        winnerChosen={match.winnerId !== undefined}
        onPick={onPick}
      />
    </div>
  );
}

function SideButton({
  matchId,
  teamId,
  probability,
  selected,
  winnerChosen,
  onPick,
}: {
  readonly matchId: string;
  readonly teamId: TeamId | undefined;
  readonly probability: number | undefined;
  readonly selected: boolean;
  readonly winnerChosen: boolean;
  readonly onPick: (matchId: string, teamId: TeamId) => void;
}) {
  if (teamId === undefined) {
    return (
      <span className="bracket-side is-empty" aria-hidden="true">
        <span className="bracket-side__tbd">To be decided</span>
      </span>
    );
  }

  const dimmed = winnerChosen && !selected;
  return (
    <button
      className={`bracket-side ${selected ? "is-winner" : ""} ${
        dimmed ? "is-dimmed" : ""
      }`}
      onClick={() => onPick(matchId, teamId)}
      type="button"
    >
      <TeamName team={getTeam(teamId)} compact />
      {probability !== undefined && (
        <span className="bracket-side__prob">{percent(probability, 0)}</span>
      )}
    </button>
  );
}

function winProbabilities(
  homeId: TeamId | undefined,
  awayId: TeamId | undefined,
): { home: number; away: number } | undefined {
  if (homeId === undefined || awayId === undefined) return undefined;
  const home = winProbability(
    getTeamProfile(homeId).modelRating,
    getTeamProfile(awayId).modelRating,
  );
  return { home, away: 1 - home };
}
