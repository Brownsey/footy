import type { TeamId } from "@/domain/types";

/**
 * Stored bookmaker research (build brief, §7 calibration source).
 *
 * Pre-tournament World Cup 2026 *outright winner* prices, captured so the model
 * can be calibrated against — and re-derived from — the betting market without
 * re-scraping. Prices are decimal (stake returned included: a 5.50 shot returns
 * 5.50× the stake). Where several books were sampled they are kept under
 * {@link MarketOdds.books}; {@link MarketOdds.decimal} is the working consensus.
 *
 * This is the single source of market truth: chalk's base ratings were
 * calibrated to it, and the "Bookies' favourites contrarian" lens reads it
 * directly to back the longest shots.
 *
 * Source: a full-field BetMGM/Yahoo snapshot for all 48 teams, with the top of
 * the market cross-checked vs FOX, ESPN, Bet365 and William Hill (fractional
 * converted to decimal). As of 2026-06-10, pre-tournament.
 */
export type Bookmaker = "bet365" | "williamHill" | "fox";

export interface MarketOdds {
  readonly teamId: TeamId;
  /** Consensus decimal outright price. */
  readonly decimal: number;
  /** Per-book decimal prices, where sampled. */
  readonly books?: Partial<Record<Bookmaker, number>>;
}

export interface MarketOddsData {
  readonly asOf: string;
  readonly market: string;
  readonly source: string;
  readonly odds: readonly MarketOdds[];
}

export const marketOddsData: MarketOddsData = {
  asOf: "2026-06-10",
  market: "outright-winner",
  source:
    "Full-field BetMGM/Yahoo snapshot (all 48 teams); top of market cross-checked vs FOX, ESPN, Bet365 and William Hill (pre-tournament).",
  odds: [
    { teamId: "spain", decimal: 5.5, books: { bet365: 5.5, williamHill: 5.5, fox: 5.75 } },
    { teamId: "france", decimal: 6.0, books: { bet365: 6.0, williamHill: 5.5, fox: 6.0 } },
    { teamId: "england", decimal: 7.5, books: { bet365: 7.5, williamHill: 7.0, fox: 8.0 } },
    { teamId: "brazil", decimal: 9.0, books: { bet365: 9.0, williamHill: 9.0, fox: 9.5 } },
    { teamId: "argentina", decimal: 9.5, books: { bet365: 9.0, williamHill: 10.0, fox: 10.0 } },
    { teamId: "portugal", decimal: 9.5, books: { bet365: 9.0, williamHill: 9.0, fox: 11.0 } },
    { teamId: "germany", decimal: 15.0, books: { fox: 15.0 } },
    { teamId: "netherlands", decimal: 21.0, books: { fox: 23.0 } },
    { teamId: "belgium", decimal: 34.0, books: { fox: 36.0 } },
    { teamId: "norway", decimal: 34.0 },
    { teamId: "colombia", decimal: 41.0, books: { fox: 41.0 } },
    { teamId: "morocco", decimal: 41.0, books: { fox: 51.0 } },
    { teamId: "japan", decimal: 51.0, books: { fox: 66.0 } },
    { teamId: "united-states", decimal: 51.0, books: { fox: 61.0 } },
    { teamId: "mexico", decimal: 67.0, books: { fox: 81.0 } },
    { teamId: "senegal", decimal: 67.0 },
    { teamId: "switzerland", decimal: 67.0 },
    { teamId: "turkiye", decimal: 67.0 },
    { teamId: "uruguay", decimal: 67.0, books: { fox: 51.0 } },
    { teamId: "croatia", decimal: 81.0, books: { fox: 81.0 } },
    { teamId: "ecuador", decimal: 81.0 },
    { teamId: "sweden", decimal: 101.0 },
    { teamId: "austria", decimal: 151.0 },
    { teamId: "canada", decimal: 151.0 },
    { teamId: "ivory-coast", decimal: 201.0 },
    { teamId: "algeria", decimal: 251.0 },
    { teamId: "bosnia-herzegovina", decimal: 251.0 },
    { teamId: "czechia", decimal: 251.0 },
    { teamId: "egypt", decimal: 251.0 },
    { teamId: "south-korea", decimal: 251.0 },
    { teamId: "paraguay", decimal: 251.0 },
    { teamId: "scotland", decimal: 251.0 },
    { teamId: "australia", decimal: 501.0 },
    { teamId: "ghana", decimal: 501.0 },
    { teamId: "iran", decimal: 501.0 },
    { teamId: "tunisia", decimal: 501.0 },
    { teamId: "dr-congo", decimal: 751.0 },
    { teamId: "cape-verde", decimal: 1001.0 },
    { teamId: "iraq", decimal: 1001.0 },
    { teamId: "jordan", decimal: 1001.0 },
    { teamId: "new-zealand", decimal: 1001.0 },
    { teamId: "panama", decimal: 1001.0 },
    { teamId: "qatar", decimal: 1001.0 },
    { teamId: "saudi-arabia", decimal: 1001.0 },
    { teamId: "south-africa", decimal: 1001.0 },
    { teamId: "uzbekistan", decimal: 1001.0 },
    { teamId: "curacao", decimal: 2501.0 },
    { teamId: "haiti", decimal: 2501.0 },
  ],
};

const oddsByTeamId: ReadonlyMap<TeamId, MarketOdds> = new Map(
  marketOddsData.odds.map((entry) => [entry.teamId, entry]),
);

/** The consensus decimal outright price for a team, if it was researched. */
export function getMarketDecimal(teamId: TeamId): number | undefined {
  return oddsByTeamId.get(teamId)?.decimal;
}

/** Raw implied win probability from a decimal price (with the book's margin). */
export function impliedProbability(decimal: number): number {
  return 1 / decimal;
}

/**
 * An Elo-scale rating implied by an outright price, on the same scale as the
 * teams' model ratings. Fitted to the calibrated contender tier so a researched
 * price reproduces the team's base rating (e.g. Spain 5.5 → ~1940, Germany
 * 15.0 → ~1868, Croatia 81 → ~1755). Longer prices map to lower ratings,
 * monotonically.
 */
export function oddsImpliedRating(decimal: number): number {
  return Math.round(2037 - 64.3 * Math.log(decimal - 1));
}
