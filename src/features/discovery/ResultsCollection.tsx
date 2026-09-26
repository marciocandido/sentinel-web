import { Info } from "lucide-react";
import { Fragment, useState, type ReactNode } from "react";
import type { FeedbackSource } from "../../types/api";
import { FeedbackPanel } from "./FeedbackPanel";
import { feedbackPanelId } from "./feedbackUtils";

export interface ResultColumn<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
}

export interface ResultCardField {
  label: string;
  value: ReactNode;
}

/** Modelo de card móvel; usa os mesmos formatadores das colunas da tabela. */
export interface ResultCardModel {
  title: string;
  subtitle?: string;
  code?: string;
  tag?: string;
  fields: ResultCardField[];
}

interface ResultsCollectionProps<T> {
  items: T[];
  caption: string;
  tableClassName?: string;
  columns: ResultColumn<T>[];
  rowKey: (item: T, index: number) => string;
  highlight?: (item: T) => boolean;
  card: (item: T) => ResultCardModel;
  narrow: boolean;
  onSelect?: (item: T) => void;
  canSelect?: (item: T) => boolean;
  feedbackSource: FeedbackSource | null;
  feedbackCnpj: (item: T) => string | null;
  itemName: (item: T) => string;
}

/** Status comercial sempre provisório: nunca há fonte ERP no v1. */
export function CommercialStatus() {
  return (
    <>
      <span className="status-unknown">
        <Info aria-hidden="true" size={13} />
        Desconhecido
      </span>
      <span className="cell-secondary">sem ERP</span>
    </>
  );
}

export function MatchTag({ label }: { label: string | null }) {
  return label ? <span className="match-tag">{label}</span> : null;
}

/**
 * Tabela compacta no desktop e cards na viewport estreita, sobre os mesmos
 * itens na ordem da API. Detalhes e feedback são ações por item.
 */
export function ResultsCollection<T>({
  items,
  caption,
  tableClassName = "",
  columns,
  rowKey,
  highlight,
  card,
  narrow,
  onSelect,
  canSelect = () => true,
  feedbackSource,
  feedbackCnpj,
  itemName,
}: ResultsCollectionProps<T>) {
  const [openFeedback, setOpenFeedback] = useState<string | null>(null);

  const actions = (item: T) => {
    const cnpj = feedbackCnpj(item);
    const name = itemName(item);
    const selectable = onSelect && canSelect(item);
    if (!selectable && !cnpj) return <span className="cell-secondary">Sem detalhes</span>;
    return (
      <div className="row-actions">
        {selectable && (
          <button className="table-action" type="button" aria-label={`Detalhes de ${name}`} onClick={() => onSelect(item)}>
            Detalhes
          </button>
        )}
        {cnpj && (
          <button
            className="table-action table-action--quiet"
            type="button"
            aria-expanded={openFeedback === cnpj}
            aria-controls={feedbackPanelId(cnpj)}
            aria-label={`Feedback de ${name}`}
            onClick={() => setOpenFeedback((current) => (current === cnpj ? null : cnpj))}
          >
            Feedback
          </button>
        )}
      </div>
    );
  };

  const feedbackPanel = (item: T) => {
    const cnpj = feedbackCnpj(item);
    return cnpj && openFeedback === cnpj
      ? <FeedbackPanel cnpjFull={cnpj} companyName={itemName(item)} source={feedbackSource} />
      : null;
  };

  if (narrow) {
    return (
      <ul className="result-cards" aria-label={caption}>
        {items.map((item, index) => {
          const model = card(item);
          return (
            <li key={rowKey(item, index)} className={`result-card${highlight?.(item) ? " result-card--highlight" : ""}`}>
              <h3 className="result-card__title">{model.title}</h3>
              {model.subtitle && <p className="result-card__subtitle">{model.subtitle}</p>}
              {model.code && <p className="result-card__code cell-code">{model.code}</p>}
              {model.tag && <p className="reference-tag">{model.tag}</p>}
              <dl className="result-card__fields">
                {model.fields.map((field) => (
                  <div key={field.label}>
                    <dt>{field.label}</dt>
                    <dd>{field.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="result-card__actions">{actions(item)}</div>
              {feedbackPanel(item)}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="table-scroll">
      <table className={`results-table results-table--compact ${tableClassName}`.trim()}>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => <th key={column.key} scope="col">{column.header}</th>)}
            <th scope="col"><span className="sr-only">Ações</span></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const panel = feedbackPanel(item);
            return (
              <Fragment key={rowKey(item, index)}>
                <tr className={highlight?.(item) ? "row-highlight" : undefined}>
                  {columns.map((column) => <td key={column.key}>{column.render(item)}</td>)}
                  <td className="cell-actions">{actions(item)}</td>
                </tr>
                {panel && (
                  <tr className="feedback-row">
                    <td colSpan={columns.length + 1}>{panel}</td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
