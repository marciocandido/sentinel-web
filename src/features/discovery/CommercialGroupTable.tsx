import type {
  CommercialGroupItem,
  CommercialGroupKnownEstablishment,
} from "../../types/api";
import {
  commercialGroupRoleLabel,
  commercialGroupValue,
} from "./commercialGroupUtils";

interface CommercialGroupTableProps {
  items: CommercialGroupItem[];
  onSelect: (item: CommercialGroupKnownEstablishment) => void;
}

function location(item: CommercialGroupKnownEstablishment): string {
  const values = [item.municipio_nome, item.uf].filter(Boolean);
  return values.length ? values.join(" / ") : "—";
}

export function CommercialGroupTable({
  items,
  onSelect,
}: CommercialGroupTableProps) {
  return (
    <div className="table-scroll">
      <table className="results-table commercial-group-table">
        <caption>
          Raízes registradas e estabelecimentos conhecidos do grupo comercial
        </caption>
        <thead>
          <tr>
            <th scope="col">Raiz</th>
            <th scope="col">Estabelecimento conhecido</th>
            <th scope="col">Papel</th>
            <th scope="col">Empresa</th>
            <th scope="col">CNPJ</th>
            <th scope="col">Município/UF</th>
            <th scope="col">Situação Receita</th>
            <th scope="col">CNAE principal</th>
            <th scope="col">Relação</th>
            <th scope="col">Fonte</th>
            <th scope="col">Confiança cadastrada</th>
            <th scope="col">Geografia</th>
            <th scope="col">Situação comercial</th>
            <th scope="col">Ação</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr
              key={[
                item.group_id,
                item.cnpj_root,
                item.establishment_known ? item.cnpj_full : index,
              ].join("-")}
            >
              <td className="cell-code">{item.cnpj_root}</td>
              <td>
                {item.establishment_known
                  ? "Sim"
                  : "Estabelecimento não disponível na base útil"}
              </td>
              <td>
                {item.establishment_known
                  ? commercialGroupRoleLabel(item.establishment_role)
                  : "—"}
              </td>
              <td>
                {item.establishment_known ? (
                  <>
                    <strong>{commercialGroupValue(item.razao_social)}</strong>
                    <span className="cell-secondary">
                      {commercialGroupValue(item.nome_fantasia)}
                    </span>
                  </>
                ) : (
                  "—"
                )}
              </td>
              <td className="cell-code">
                {item.establishment_known ? item.cnpj_full : "—"}
              </td>
              <td>{item.establishment_known ? location(item) : "—"}</td>
              <td>
                {item.establishment_known
                  ? "Código Receita: " +
                    commercialGroupValue(item.situacao_cadastral)
                  : "—"}
              </td>
              <td className="cell-code">
                {item.establishment_known
                  ? commercialGroupValue(item.cnae_principal)
                  : "—"}
              </td>
              <td>{item.relation_type}</td>
              <td>{item.relation_source}</td>
              <td>
                {item.confidence === null
                  ? "—"
                  : "Confiança cadastrada: " + item.confidence}
              </td>
              <td>
                {item.establishment_known ? (
                  <>
                    {commercialGroupValue(item.location_precision)}
                    <span className="cell-secondary">
                      {item.has_geo
                        ? "Geografia disponível"
                        : "Geografia não disponível"}
                    </span>
                  </>
                ) : (
                  "—"
                )}
              </td>
              <td>
                <span className="status-unknown">
                  Desconhecido (provisório)
                </span>
              </td>
              <td>
                {item.establishment_known ? (
                  <button
                    className="table-action"
                    type="button"
                    onClick={() => onSelect(item)}
                  >
                    Ver detalhes
                  </button>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
