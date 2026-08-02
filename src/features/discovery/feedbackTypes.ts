import type { FeedbackAction, FeedbackSource } from "../../types/api";

export interface FeedbackAttempt {
  action: FeedbackAction;
  idempotencyKey: string;
}

export const FEEDBACK_ACTION_LABELS: Record<FeedbackAction, string> = {
  USEFUL: "Útil",
  DISCARD: "Descartar",
  ALREADY_KNOW: "Já conheço",
  BAD_CONTACT: "Contato ruim",
  BECAME_VISIT: "Virou visita",
  BECAME_QUOTE: "Virou orçamento",
  BECAME_SALE: "Virou venda (informado)",
};

export const FEEDBACK_ACTIONS = Object.keys(FEEDBACK_ACTION_LABELS) as FeedbackAction[];

export interface FeedbackPanelProps {
  cnpjFull: string;
  companyName: string;
  source: FeedbackSource;
}
