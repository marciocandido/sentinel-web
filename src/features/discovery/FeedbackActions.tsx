import type { FeedbackAction } from "../../types/api";
import { FEEDBACK_ACTIONS, FEEDBACK_ACTION_LABELS } from "./feedbackTypes";

interface FeedbackActionsProps {
  disabled: boolean;
  onAction: (action: FeedbackAction) => void;
}

export function FeedbackActions({ disabled, onAction }: FeedbackActionsProps) {
  return (
    <fieldset className="feedback-actions" disabled={disabled}>
      <legend>Registrar feedback comercial</legend>
      <div>
        {FEEDBACK_ACTIONS.map((action) => (
          <button key={action} type="button" className="table-action" onClick={() => onAction(action)}>
            {FEEDBACK_ACTION_LABELS[action]}
          </button>
        ))}
      </div>
      <p className="feedback-sale-note">
        Virou venda (informado) registra informação do operador e não confirma venda ou pedido no ERP.
      </p>
    </fieldset>
  );
}
