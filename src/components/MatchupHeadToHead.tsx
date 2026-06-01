import type { InsightFactor } from "@/domain/matchupInsight";

/**
 * The head-to-head strip: one row per analytical dimension, with a lit dot on
 * the side each factor favours, optionally followed by profile-derived
 * "what to expect" notes. Shared by the group fixture rows and the knockout
 * bracket so every "team vs team" surface reads the same way.
 */
export function MatchupHeadToHead({
  factors,
  whatToExpect,
  sideAName,
  sideBName,
}: {
  readonly factors: readonly InsightFactor[];
  readonly whatToExpect?: readonly string[];
  readonly sideAName: string;
  readonly sideBName: string;
}) {
  return (
    <section
      className="head-to-head"
      aria-label={`Head-to-head: ${sideAName} versus ${sideBName}`}
    >
      <header className="head-to-head__teams">
        <span>{sideAName}</span>
        <span>Edge</span>
        <span>{sideBName}</span>
      </header>
      <ul>
        {factors.map((factor) => (
          <li
            className={`h2h-row h2h-row--${factor.edge.toLowerCase()}`}
            key={factor.label}
          >
            <span className="h2h-row__dot h2h-row__dot--a" aria-hidden="true" />
            <span className="h2h-row__label">
              {factor.label}
              <small>{factor.detail}</small>
            </span>
            <span className="h2h-row__dot h2h-row__dot--b" aria-hidden="true" />
          </li>
        ))}
      </ul>
      {whatToExpect && whatToExpect.length > 0 && (
        <div className="head-to-head__expect">
          <p className="head-to-head__expect-title">What to expect</p>
          <ul>
            {whatToExpect.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
