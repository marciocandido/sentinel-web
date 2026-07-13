import type { RadiusSearchEstablishment } from "../../types/api";
import { matchLabel } from "./discoveryUtils";

const show = (value: string | null) =>
  value === null || value === "" ? "—" : value;

interface RadiusTableProps {
  items: RadiusSearchEstablishment[];
  onSelect: (item: RadiusSearchEstablishment) => void;
}

export function RadiusTable({ items, onSelect }: RadiusTableProps) {
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
            <tr key={item.cnpj_full}>
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
