import type { FeedbackHistoryPage } from "../../types/api";
import { FEEDBACK_ACTION_LABELS, formatFeedbackEvent } from "./feedbackUtils";

interface FeedbackHistoryProps {
  state: "idle" | "loading" | "success" | "error";
  page: FeedbackHistoryPage | null;
  onPrevious: () => void;
  onNext: () => void;
}

export function FeedbackHistory({ state, page, onPrevious, onNext }: FeedbackHistoryProps) {
  if (state === "loading") return <p role="status">Carregando histórico…</p>;
  if (state !== "success" || !page) return null;
  return (
    <section className="feedback-history" aria-label="Histórico de feedback">
      <h4>Histórico</h4>
      <p className="muted">Ator provisório: {page.actor_id}</p>
      {page.items.length === 0 ? (
        <p className="muted">Ainda não há feedback registrado para este estabelecimento.</p>
      ) : (
      <ul>
        {page.items.map((event) => (
          <li key={event.event_id}>
            <strong>{FEEDBACK_ACTION_LABELS[event.action]}</strong> · {formatFeedbackEvent(event)} · Ator provisório: {event.actor_id}
            {event.source && <> · Origem: {event.source.kind}{event.source.reference !== null ? ` (${event.source.reference})` : ""}</>}
          </li>
        ))}
      </ul>
      )}
      <div className="feedback-history-pagination">
        <button type="button" className="secondary-button" disabled={page.pagination.offset === 0} onClick={onPrevious}>Anterior</button>
        <button type="button" className="secondary-button" disabled={!page.pagination.has_more} onClick={onNext}>Próxima</button>
      </div>
    </section>
  );
}
