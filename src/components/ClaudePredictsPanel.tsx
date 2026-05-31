import { TeamName } from "@/components/TeamName";
import { getTeam } from "@/data/tournament";
import type { PredictionSet } from "@/domain/claudePredicts";

export function ClaudePredictsPanel({
  sets,
  activeId,
  onApply,
}: {
  readonly sets: readonly PredictionSet[];
  readonly activeId: string | null;
  readonly onApply: (set: PredictionSet) => void;
}) {
  return (
    <section className="predicts" aria-label="Claude Predicts templates">
      <div className="section-heading">
        <div>
          <p className="section-heading__eyebrow">Claude Predicts</p>
          <h2>Ten philosophies, ten brackets</h2>
        </div>
        <p>
          Each set re-rates all 48 teams through one footballing lens, then runs
          the same model. Load one as a starting point and edit freely.
        </p>
      </div>

      <div className="predicts__grid">
        {sets.map((set) => {
          const champion = getTeam(set.championId);
          const isActive = set.id === activeId;
          return (
            <article
              className={`predict-card ${isActive ? "is-active" : ""}`}
              key={set.id}
            >
              <header>
                <h3>{set.name}</h3>
                {isActive && <span className="predict-card__tag">Loaded</span>}
              </header>
              <p className="predict-card__rationale">{set.rationale}</p>
              <div className="predict-card__champion">
                <span>Projected winner</span>
                <TeamName team={champion} compact />
              </div>
              <button
                className="button button--ghost"
                onClick={() => onApply(set)}
                type="button"
              >
                {isActive ? "Reload picks" : "Load picks"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
