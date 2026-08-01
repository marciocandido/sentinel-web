import type { NeighborEstablishment } from "../../types/api";
import { matchLabel } from "./discoveryUtils";

const show = (value: string | null) => value || "—";

export function NeighborsTable({ items }: { items: NeighborEstablishment[] }) {
  return <div className="table-scroll"><table className="results-table neighbors-table"><caption>Estabelecimentos vizinhos retornados pela API</caption><thead><tr><th scope="col">Empresa</th><th scope="col">CNPJ</th><th scope="col">Município/UF</th><th scope="col">Distância</th><th scope="col">CNAE principal</th><th scope="col">Correspondência</th><th scope="col">Precisão</th><th scope="col">Situação comercial</th></tr></thead><tbody>{items.map((item) => <tr key={item.cnpj_full}><td><strong>{show(item.razao_social)}</strong><span className="cell-secondary">{show(item.nome_fantasia)}</span></td><td className="cell-code">{item.cnpj_full}</td><td>{[item.municipio_nome, item.uf].filter(Boolean).join(" / ") || "—"}</td><td>{item.distance_km.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km</td><td className="cell-code">{show(item.cnae_principal)}</td><td>{matchLabel(item)}</td><td>{item.location_precision}</td><td><span className="status-unknown">Desconhecido (provisório)</span></td></tr>)}</tbody></table></div>;
}
