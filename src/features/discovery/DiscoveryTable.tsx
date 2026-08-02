import { Fragment, useState } from "react";
import type { DiscoveryEstablishment, FeedbackSource } from "../../types/api";
import { FeedbackPanel } from "./FeedbackPanel";
import { feedbackPanelId } from "./feedbackUtils";
import { matchLabel } from "./discoveryUtils";

function display(value: string | null): string {
  return value === null || value === "" ? "—" : value;
}

function location(establishment: DiscoveryEstablishment): string {
  const parts = [establishment.municipio_nome, establishment.uf].filter(Boolean);
  return parts.length ? parts.join(" / ") : "—";
}

interface DiscoveryTableProps {
  items: DiscoveryEstablishment[];
  onSelectEstablishment: (establishment: DiscoveryEstablishment) => void;
  feedbackSource: FeedbackSource;
}

export function DiscoveryTable({ items, onSelectEstablishment, feedbackSource }: DiscoveryTableProps) {
  const [openFeedbackCnpj, setOpenFeedbackCnpj] = useState<string | null>(null);
  return (
    <div className="table-scroll">
      <table className="results-table">
        <caption>Empresas encontradas pelos critérios submetidos</caption>
        <thead>
          <tr>
            <th scope="col">Empresa</th>
            <th scope="col">CNPJ</th>
            <th scope="col">Município/UF</th>
            <th scope="col">CNAE principal</th>
            <th scope="col">Porte</th>
            <th scope="col">Capital social</th>
            <th scope="col">Correspondência</th>
            <th scope="col">Precisão geográfica</th>
            <th scope="col">Status comercial</th>
            <th scope="col">Ações</th>
          </tr>
        </thead>
        <tbody>
          {items.map((establishment) => (
            <Fragment key={establishment.cnpj_full}>
            <tr>
              <td>
                <strong>{display(establishment.razao_social)}</strong>
                <span className="cell-secondary">{display(establishment.nome_fantasia)}</span>
              </td>
              <td className="cell-code">{establishment.cnpj_full}</td>
              <td>{location(establishment)}</td>
              <td className="cell-code">{display(establishment.cnae_principal)}</td>
              <td className="cell-code">{display(establishment.porte_codigo)}</td>
              <td className="cell-code">{display(establishment.capital_social)}</td>
              <td>{matchLabel(establishment)}</td>
              <td>{display(establishment.location_precision)}</td>
              <td>
                <span className="status-unknown">Desconhecido (provisório)</span>
                <span className="cell-secondary">Sem fonte comercial</span>
              </td>
              <td>
                <button
                  className="table-action"
                  type="button"
                  onClick={() => onSelectEstablishment(establishment)}
                >
                  Ver detalhes
                </button>
                <button
                  className="table-action"
                  type="button"
                  aria-expanded={openFeedbackCnpj === establishment.cnpj_full}
                  aria-controls={feedbackPanelId(establishment.cnpj_full)}
                  onClick={() => setOpenFeedbackCnpj((current) => current === establishment.cnpj_full ? null : establishment.cnpj_full)}
                >
                  Feedback
                </button>
              </td>
            </tr>
            {openFeedbackCnpj === establishment.cnpj_full && (
              <tr className="feedback-row">
                <td colSpan={10}>
                  <FeedbackPanel
                    cnpjFull={establishment.cnpj_full}
                    companyName={display(establishment.razao_social !== null ? establishment.razao_social : establishment.nome_fantasia)}
                    source={feedbackSource}
                  />
                </td>
              </tr>
            )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
