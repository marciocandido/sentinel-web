import type { FeedbackEvent } from "../../types/api";
import { FEEDBACK_ACTION_LABELS } from "./feedbackTypes";

export function publicFeedbackError(code: string): string {
  const messages: Record<string, string> = {
    invalid_request: "Não foi possível registrar o feedback informado.",
    establishment_not_found: "O estabelecimento não está mais disponível na base útil.",
    idempotency_conflict: "Esta tentativa não foi aplicada porque a chave já pertence a outra ação.",
    database_unavailable: "A base do Sentinel está temporariamente indisponível.",
    invalid_response: "A API retornou uma resposta inválida.",
    network_error: "Não foi possível conectar ao Sentinel.",
  };
  return messages[code] ?? "Não foi possível conectar ao Sentinel.";
}

export function feedbackPanelId(cnpjFull: string): string {
  return `feedback-${cnpjFull.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

export function formatFeedbackEvent(event: FeedbackEvent): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(event.occurred_at));
}

export { FEEDBACK_ACTION_LABELS };
