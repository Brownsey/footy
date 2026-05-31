import type { Guardrail } from "@/domain/guardrails";

/**
 * A non-blocking advisory shown before a flagged knockout pick is committed.
 * It never hard-blocks: the user can confirm the pick or back out.
 */
export function GuardrailDialog({
  guardrails,
  onConfirm,
  onCancel,
}: {
  readonly guardrails: readonly Guardrail[];
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) {
  if (guardrails.length === 0) return null;

  return (
    <div
      className="guardrail-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm your pick"
    >
      <div className="guardrail-card">
        {guardrails.map((guardrail) => (
          <div className="guardrail-card__item" key={guardrail.kind}>
            <h3>{guardrail.title}</h3>
            <p>{guardrail.message}</p>
          </div>
        ))}
        <div className="guardrail-card__actions">
          <button
            className="button button--ghost"
            onClick={onCancel}
            type="button"
          >
            Rethink
          </button>
          <button
            className="button button--primary"
            onClick={onConfirm}
            type="button"
          >
            Back my pick
          </button>
        </div>
      </div>
    </div>
  );
}
