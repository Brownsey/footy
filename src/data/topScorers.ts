import type { TeamId } from "@/domain/types";

/**
 * Golden Boot candidates and the inputs to the top-scorer model.
 *
 * A player's expected tournament goals are modelled as their per-game scoring
 * rate multiplied by how many games their team is expected to play (the latter
 * comes from the Monte-Carlo simulation's reach-stage probabilities). That
 * product is what separates the contenders: an elite finisher on a side that
 * exits early scores fewer than a good finisher who plays seven games.
 *
 * `goalsPerGame` is a researched estimate of each player's international
 * tournament scoring level (recent country + club output, role, penalties).
 * `marketDecimal` is the bookmakers' Golden Boot price, kept only to sanity-check
 * the model against the market — it is not an input to it.
 *
 * Source: Golden Boot prices from FanDuel/FOX (pre-tournament, 2026-06-11);
 * scoring rates synthesised from 2024–26 country and club form.
 */
export interface ScorerCandidate {
  readonly name: string;
  readonly teamId: TeamId;
  /** Researched goals-per-game at international-tournament level. */
  readonly goalsPerGame: number;
  /** Bookmaker Golden Boot decimal price (reference only). */
  readonly marketDecimal: number;
}

export const TOP_SCORERS: readonly ScorerCandidate[] = [
  { name: "Kylian Mbappe", teamId: "france", goalsPerGame: 0.66, marketDecimal: 7.0 },
  { name: "Harry Kane", teamId: "england", goalsPerGame: 0.64, marketDecimal: 8.0 },
  { name: "Erling Haaland", teamId: "norway", goalsPerGame: 0.72, marketDecimal: 17.0 },
  { name: "Mikel Oyarzabal", teamId: "spain", goalsPerGame: 0.52, marketDecimal: 13.0 },
  { name: "Lionel Messi", teamId: "argentina", goalsPerGame: 0.46, marketDecimal: 19.0 },
  { name: "Julian Alvarez", teamId: "argentina", goalsPerGame: 0.48, marketDecimal: 26.0 },
  { name: "Cristiano Ronaldo", teamId: "portugal", goalsPerGame: 0.46, marketDecimal: 23.0 },
  { name: "Raphinha", teamId: "brazil", goalsPerGame: 0.46, marketDecimal: 28.0 },
  { name: "Vinicius Junior", teamId: "brazil", goalsPerGame: 0.46, marketDecimal: 31.0 },
  { name: "Kai Havertz", teamId: "germany", goalsPerGame: 0.4, marketDecimal: 28.0 },
  { name: "Lamine Yamal", teamId: "spain", goalsPerGame: 0.4, marketDecimal: 28.0 },
  { name: "Michael Olise", teamId: "france", goalsPerGame: 0.36, marketDecimal: 28.0 },
  { name: "Lautaro Martinez", teamId: "argentina", goalsPerGame: 0.46, marketDecimal: 34.0 },
  { name: "Viktor Gyokeres", teamId: "sweden", goalsPerGame: 0.52, marketDecimal: 51.0 },
  { name: "Alexander Isak", teamId: "sweden", goalsPerGame: 0.44, marketDecimal: 67.0 },
  { name: "Dani Olmo", teamId: "spain", goalsPerGame: 0.34, marketDecimal: 51.0 },
];
