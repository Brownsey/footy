import {
  getAnnexCAllocation,
  type ThirdPlaceSlot,
} from "@/data/annexCThirdPlaceAllocation";
import type { RankedThird } from "@/domain/thirdPlace";
import type { GroupId, TeamId } from "@/domain/types";

export type RoundId = "R32" | "R16" | "QF" | "SF" | "F";

export interface RoundDefinition {
  readonly id: RoundId;
  readonly matchCount: number;
}

export interface BracketMatch {
  readonly id: string;
  readonly round: RoundId;
  readonly homeId: TeamId | undefined;
  readonly awayId: TeamId | undefined;
  readonly winnerId: TeamId | undefined;
}

export interface ResolvedBracket {
  readonly matches: readonly BracketMatch[];
  readonly rounds: ReadonlyMap<RoundId, readonly BracketMatch[]>;
  readonly winners: WinnerPicks;
  readonly championId: TeamId | undefined;
  readonly decided: number;
  readonly total: number;
}

export type WinnerPicks = Readonly<Record<string, TeamId>>;

export type OfficialMatchId =
  | "M73"
  | "M74"
  | "M75"
  | "M76"
  | "M77"
  | "M78"
  | "M79"
  | "M80"
  | "M81"
  | "M82"
  | "M83"
  | "M84"
  | "M85"
  | "M86"
  | "M87"
  | "M88"
  | "M89"
  | "M90"
  | "M91"
  | "M92"
  | "M93"
  | "M94"
  | "M95"
  | "M96"
  | "M97"
  | "M98"
  | "M99"
  | "M100"
  | "M101"
  | "M102"
  | "M103"
  | "M104";

export type OfficialRoundId =
  | "R32"
  | "R16"
  | "QF"
  | "SF"
  | "THIRD_PLACE"
  | "FINAL";

export type KnockoutSource =
  | { readonly kind: "groupWinner"; readonly groupId: GroupId }
  | { readonly kind: "groupRunnerUp"; readonly groupId: GroupId }
  | { readonly kind: "thirdPlaceSlot"; readonly slot: ThirdPlaceSlot }
  | { readonly kind: "matchWinner"; readonly matchId: OfficialMatchId }
  | { readonly kind: "matchRunnerUp"; readonly matchId: OfficialMatchId };

export interface KnockoutMatchDefinition {
  readonly id: OfficialMatchId;
  readonly round: OfficialRoundId;
  readonly sideA: KnockoutSource;
  readonly sideB: KnockoutSource;
}

export interface ThirdPlaceAssignment {
  readonly slot: ThirdPlaceSlot;
  readonly matchId: OfficialMatchId;
  readonly groupWinner: GroupId;
  readonly thirdGroup: GroupId;
  readonly teamId: TeamId;
}

export interface ThirdPlaceRoundOf32Allocation {
  readonly option: number;
  readonly assignments: readonly ThirdPlaceAssignment[];
}

export const ROUNDS: readonly RoundDefinition[] = [
  { id: "R32", matchCount: 16 },
  { id: "R16", matchCount: 8 },
  { id: "QF", matchCount: 4 },
  { id: "SF", matchCount: 2 },
  { id: "F", matchCount: 1 },
];

export const thirdPlaceSlotToRoundOf32Match: Readonly<
  Record<
    ThirdPlaceSlot,
    { readonly matchId: OfficialMatchId; readonly groupWinner: GroupId }
  >
> = {
  "1A": { matchId: "M79", groupWinner: "A" },
  "1B": { matchId: "M85", groupWinner: "B" },
  "1D": { matchId: "M81", groupWinner: "D" },
  "1E": { matchId: "M74", groupWinner: "E" },
  "1G": { matchId: "M82", groupWinner: "G" },
  "1I": { matchId: "M77", groupWinner: "I" },
  "1K": { matchId: "M87", groupWinner: "K" },
  "1L": { matchId: "M80", groupWinner: "L" },
};

export const roundOf32Matches: readonly KnockoutMatchDefinition[] = [
  match("M73", "R32", runnerUp("A"), runnerUp("B")),
  match("M74", "R32", winner("E"), thirdPlaceSlot("1E")),
  match("M75", "R32", winner("F"), runnerUp("C")),
  match("M76", "R32", winner("C"), runnerUp("F")),
  match("M77", "R32", winner("I"), thirdPlaceSlot("1I")),
  match("M78", "R32", runnerUp("E"), runnerUp("I")),
  match("M79", "R32", winner("A"), thirdPlaceSlot("1A")),
  match("M80", "R32", winner("L"), thirdPlaceSlot("1L")),
  match("M81", "R32", winner("D"), thirdPlaceSlot("1D")),
  match("M82", "R32", winner("G"), thirdPlaceSlot("1G")),
  match("M83", "R32", runnerUp("K"), runnerUp("L")),
  match("M84", "R32", winner("H"), runnerUp("J")),
  match("M85", "R32", winner("B"), thirdPlaceSlot("1B")),
  match("M86", "R32", winner("J"), runnerUp("H")),
  match("M87", "R32", winner("K"), thirdPlaceSlot("1K")),
  match("M88", "R32", runnerUp("D"), runnerUp("G")),
];

export const officialProgressionMatches: readonly KnockoutMatchDefinition[] = [
  match("M89", "R16", matchWinner("M74"), matchWinner("M77")),
  match("M90", "R16", matchWinner("M73"), matchWinner("M75")),
  match("M91", "R16", matchWinner("M76"), matchWinner("M78")),
  match("M92", "R16", matchWinner("M79"), matchWinner("M80")),
  match("M93", "R16", matchWinner("M83"), matchWinner("M84")),
  match("M94", "R16", matchWinner("M81"), matchWinner("M82")),
  match("M95", "R16", matchWinner("M86"), matchWinner("M88")),
  match("M96", "R16", matchWinner("M85"), matchWinner("M87")),
  match("M97", "QF", matchWinner("M89"), matchWinner("M90")),
  match("M98", "QF", matchWinner("M93"), matchWinner("M94")),
  match("M99", "QF", matchWinner("M91"), matchWinner("M92")),
  match("M100", "QF", matchWinner("M95"), matchWinner("M96")),
  match("M101", "SF", matchWinner("M97"), matchWinner("M98")),
  match("M102", "SF", matchWinner("M99"), matchWinner("M100")),
  match("M103", "THIRD_PLACE", matchRunnerUp("M101"), matchRunnerUp("M102")),
  match("M104", "FINAL", matchWinner("M101"), matchWinner("M102")),
];

export const officialKnockoutMatches: readonly KnockoutMatchDefinition[] = [
  ...roundOf32Matches,
  ...officialProgressionMatches,
];

const playableProgression = officialProgressionMatches.filter(
  (fixture) => fixture.round !== "THIRD_PLACE",
);

/** Resolve the visible bracket from the 32 R32 entrants and winner picks. */
export function resolveBracket(
  entrants: readonly (TeamId | undefined)[],
  picks: WinnerPicks,
): ResolvedBracket {
  const winners: Record<string, TeamId> = {};
  const byId = new Map<string, BracketMatch>();
  const matches: BracketMatch[] = [];

  roundOf32Matches.forEach((fixture, index) => {
    const resolved = resolveMatch(
      fixture.id,
      "R32",
      entrants[index * 2],
      entrants[index * 2 + 1],
      picks,
    );
    if (resolved.winnerId) winners[resolved.id] = resolved.winnerId;
    byId.set(resolved.id, resolved);
    matches.push(resolved);
  });

  for (const fixture of playableProgression) {
    const round = toVisibleRound(fixture.round);
    const homeId = resolveSource(fixture.sideA, byId, "winner");
    const awayId = resolveSource(fixture.sideB, byId, "winner");
    const resolved = resolveMatch(fixture.id, round, homeId, awayId, picks);
    if (resolved.winnerId) winners[resolved.id] = resolved.winnerId;
    byId.set(resolved.id, resolved);
    matches.push(resolved);
  }

  const rounds = new Map<RoundId, BracketMatch[]>(
    ROUNDS.map(({ id }) => [id, []]),
  );
  for (const bracketMatch of matches) {
    rounds.get(bracketMatch.round)?.push(bracketMatch);
  }

  return {
    matches,
    rounds,
    winners,
    championId: byId.get("M104")?.winnerId,
    decided: Object.keys(winners).length,
    total: matches.length,
  };
}

/** Apply one winner pick and return the fully cascaded bracket state. */
export function pickWinner(
  entrants: readonly (TeamId | undefined)[],
  picks: WinnerPicks,
  matchId: string,
  teamId: TeamId,
): ResolvedBracket {
  return resolveBracket(entrants, { ...picks, [matchId]: teamId });
}

export function assignThirdPlacedTeamsToRoundOf32(
  qualifiers: readonly RankedThird[],
): readonly ThirdPlaceAssignment[] {
  return resolveThirdPlaceRoundOf32Allocation(qualifiers).assignments;
}

export function resolveThirdPlaceRoundOf32Allocation(
  qualifiers: readonly RankedThird[],
): ThirdPlaceRoundOf32Allocation {
  if (qualifiers.length !== 8) {
    throw new Error(
      "Round of 32 third-place allocation requires eight qualifiers",
    );
  }

  const allocation = getAnnexCAllocation(
    qualifiers.map((team) => team.groupId),
  );
  const qualifiersByGroup = new Map<GroupId, RankedThird>(
    qualifiers.map((team) => [team.groupId, team]),
  );

  return {
    option: allocation.option,
    assignments: Object.entries(allocation.slots).map(([slot, thirdGroup]) => {
      const typedSlot = slot as ThirdPlaceSlot;
      const qualifier = qualifiersByGroup.get(thirdGroup);
      const fixture = thirdPlaceSlotToRoundOf32Match[typedSlot];
      if (!qualifier) {
        throw new Error(`No third-place qualifier from Group ${thirdGroup}`);
      }
      return {
        slot: typedSlot,
        matchId: fixture.matchId,
        groupWinner: fixture.groupWinner,
        thirdGroup,
        teamId: qualifier.teamId,
      };
    }),
  };
}

function resolveMatch(
  id: string,
  round: RoundId,
  homeId: TeamId | undefined,
  awayId: TeamId | undefined,
  picks: WinnerPicks,
): BracketMatch {
  const picked = picks[id];
  const winnerId =
    picked && (picked === homeId || picked === awayId) ? picked : undefined;
  return { id, round, homeId, awayId, winnerId };
}

function resolveSource(
  source: KnockoutSource,
  matches: ReadonlyMap<string, BracketMatch>,
  expected: "winner" | "runnerUp",
): TeamId | undefined {
  if (source.kind !== "matchWinner" && source.kind !== "matchRunnerUp") {
    return undefined;
  }
  const resolved = matches.get(source.matchId);
  if (!resolved?.winnerId) return undefined;
  if (expected === "winner" || source.kind === "matchWinner") {
    return resolved.winnerId;
  }
  return resolved.winnerId === resolved.homeId
    ? resolved.awayId
    : resolved.homeId;
}

function toVisibleRound(round: OfficialRoundId): RoundId {
  switch (round) {
    case "R32":
    case "R16":
    case "QF":
    case "SF":
      return round;
    case "FINAL":
      return "F";
    case "THIRD_PLACE":
      throw new Error(
        "Third-place play-off is not part of the visible bracket",
      );
  }
}

function match(
  id: OfficialMatchId,
  round: OfficialRoundId,
  sideA: KnockoutSource,
  sideB: KnockoutSource,
): KnockoutMatchDefinition {
  return { id, round, sideA, sideB };
}

function winner(groupId: GroupId): KnockoutSource {
  return { kind: "groupWinner", groupId };
}

function runnerUp(groupId: GroupId): KnockoutSource {
  return { kind: "groupRunnerUp", groupId };
}

function thirdPlaceSlot(slot: ThirdPlaceSlot): KnockoutSource {
  return { kind: "thirdPlaceSlot", slot };
}

function matchWinner(matchId: OfficialMatchId): KnockoutSource {
  return { kind: "matchWinner", matchId };
}

function matchRunnerUp(matchId: OfficialMatchId): KnockoutSource {
  return { kind: "matchRunnerUp", matchId };
}
