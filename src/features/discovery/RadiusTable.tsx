import { Fragment, useState } from "react";
import type { FeedbackSource, RadiusSearchEstablishment } from "../../types/api";
import { FeedbackPanel } from "./FeedbackPanel";
import { feedbackPanelId } from "./feedbackUtils";
import { matchLabel } from "./discoveryUtils";

const show = (value: string | null) =>
  value === null || value === "" ? "—" : value;

interface RadiusTableProps {
  items: RadiusSearchEstablishment[];
  onSelect: (item: RadiusSearchEstablishment) => void;
  feedbackSource: FeedbackSource;
}

export function RadiusTable({ items, onSelect, feedbackSource }: RadiusTableProps) {
  const [openFeedbackCnpj, setOpenFeedbackCnpj] = useState<string | null>(null);
  return (
    <div className="table-scroll">
      <table className="results-table radius-table">
        <caption>Estabelecimentos retornados pela busca por raio</caption>
        <thead>
          <tr>
            <th scope="col">Empresa</th>
            <th scope="col">CNPJ</th>
            <th scope="col">Município/UF</th>
            <th scope="col">Distância</th>
            <th scope="col">CNAE principal</th>
            <th scope="col">Correspondência</th>
            <th scope="col">Porte</th>
            <th scope="col">Capital</th>
            <th scope="col">Precisão</th>
            <th scope="col">Situação comercial</th>
            <th scope="col">Ação</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <Fragment key={item.cnpj_full}>
            <tr>
              <td>
                <strong>{show(item.razao_social)}</strong>
                <span className="cell-secondary">
                  {show(item.nome_fantasia)}
                </span>
              </td>
              <td className="cell-code">{item.cnpj_full}</td>
              <td>
                {[item.municipio_nome, item.uf].filter(Boolean).join(" / ") ||
                  "—"}
              </td>
              <td>
                {item.distance_km.toLocaleString("pt-BR", {
                  maximumFractionDigits: 2,
                })} km
              </td>
              <td className="cell-code">{show(item.cnae_principal)}</td>
              <td>{matchLabel(item)}</td>
              <td>{show(item.porte_codigo)}</td>
              <td>{show(item.capital_social)}</td>
              <td>{item.location_precision}</td>
              <td>
                <span className="status-unknown">
                  Desconhecido (provisório)
                </span>
              </td>
              <td>
                <button
                  className="table-action"
                  type="button"
                  onClick={() => onSelect(item)}
                >
                  Ver detalhes
                </button>
                <button className="table-action" type="button" aria-expanded={openFeedbackCnpj === item.cnpj_full} aria-controls={feedbackPanelId(item.cnpj_full)} onClick={() => setOpenFeedbackCnpj((current) => current === item.cnpj_full ? null : item.cnpj_full)}>Feedback</button>
              </td>
            </tr>
            {openFeedbackCnpj === item.cnpj_full && <tr className="feedback-row"><td colSpan={11}><FeedbackPanel cnpjFull={item.cnpj_full} companyName={show(item.razao_social !== null ? item.razao_social : item.nome_fantasia)} source={feedbackSource} /></td></tr>}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
