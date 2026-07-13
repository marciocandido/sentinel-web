import type { RootBranchEstablishment } from "../../types/api";
import { matchLabel } from "./discoveryUtils";
import {
  rootBranchRoleLabel,
  rootBranchValue,
} from "./rootBranchesUtils";

interface RootBranchesTableProps {
  items: RootBranchEstablishment[];
  onSelect: (item: RootBranchEstablishment) => void;
}

function location(item: RootBranchEstablishment): string {
  return [item.municipio_nome, item.uf].filter(Boolean).join(" / ") || "—";
}

export function RootBranchesTable({
  items,
  onSelect,
}: RootBranchesTableProps) {
  return (
    <div className="table-scroll">
      <table className="results-table root-branches-table">
        <caption>
          Estabelecimentos conhecidos da raiz na base útil do Sentinel
        </caption>
        <thead>
          <tr>
            <th scope="col">Papel</th>
            <th scope="col">Empresa</th>
            <th scope="col">CNPJ</th>
            <th scope="col">Ordem/DV</th>
            <th scope="col">Município/UF</th>
            <th scope="col">Situação Receita</th>
            <th scope="col">Início da atividade</th>
            <th scope="col">CNAE principal</th>
            <th scope="col">Correspondência</th>
            <th scope="col">Porte</th>
            <th scope="col">Capital</th>
            <th scope="col">Geografia</th>
            <th scope="col">Situação comercial</th>
            <th scope="col">Ação</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.cnpj_full}>
              <td>
                <strong>{rootBranchRoleLabel(item.establishment_role)}</strong>
                <span className="cell-secondary">
                  Código Receita: {item.matriz_filial}
                </span>
              </td>
              <td>
                <strong>{rootBranchValue(item.razao_social)}</strong>
                <span className="cell-secondary">
                  {rootBranchValue(item.nome_fantasia)}
                </span>
              </td>
              <td className="cell-code">{item.cnpj_full}</td>
              <td className="cell-code">
                {item.cnpj_order} / {item.cnpj_dv}
              </td>
              <td>{location(item)}</td>
              <td>Código Receita: {item.situacao_cadastral}</td>
              <td>{rootBranchValue(item.data_inicio_atividade)}</td>
              <td className="cell-code">
                {rootBranchValue(item.cnae_principal)}
              </td>
              <td>{matchLabel(item)}</td>
              <td className="cell-code">
                {rootBranchValue(item.porte_codigo)}
              </td>
              <td className="cell-code">
                {rootBranchValue(item.capital_social)}
              </td>
              <td>
                {rootBranchValue(item.location_precision)}
                <span className="cell-secondary">
                  {item.has_geo
                    ? "Geografia disponível"
                    : "Geografia não disponível"}
                </span>
              </td>
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
