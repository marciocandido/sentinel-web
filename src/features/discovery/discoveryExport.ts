import type {
  DiscoveryExportFile,
  DiscoveryExportSearch,
} from "../../services/sentinelApi";
import type { CommercialGroupSearchSnapshot } from "./commercialGroupTypes";
import type { DiscoverySearchSnapshot } from "./discoveryTypes";
import type { NeighborsSearchSnapshot } from "./neighborsTypes";
import type { RadiusSearchSnapshot } from "./radiusTypes";
import type { RootBranchesSearchSnapshot } from "./rootBranchesTypes";

export type DiscoveryExportSnapshot =
  | { kind: "standard"; snapshot: DiscoverySearchSnapshot }
  | { kind: "radius"; snapshot: RadiusSearchSnapshot }
  | { kind: "neighbors"; snapshot: NeighborsSearchSnapshot }
  | { kind: "root"; snapshot: RootBranchesSearchSnapshot }
  | { kind: "group"; snapshot: CommercialGroupSearchSnapshot }
  | { kind: "similar"; cnpjFull: string };

function present(value: string): string | undefined {
  return value || undefined;
}

export function toDiscoveryExportSearch(
  input: DiscoveryExportSnapshot,
): DiscoveryExportSearch {
  if (input.kind === "standard") {
    const snapshot = input.snapshot;
    if (snapshot.mode === "segment") {
      return {
        kind: "SEGMENT",
        segment_id: snapshot.segmentId,
        uf: present(snapshot.uf),
        codigo_tom: present(snapshot.codigoTom),
        porte_codigo: present(snapshot.porteCodigo),
        capital_min: present(snapshot.capitalMin),
        capital_max: present(snapshot.capitalMax),
      };
    }
    return {
      kind: "REGION",
      uf: present(snapshot.uf),
      codigo_tom: present(snapshot.codigoTom),
      codigo_ibge: present(snapshot.codigoIbge),
      municipio_nome: present(snapshot.municipioNome),
      segment_id: present(snapshot.segmentId),
    };
  }
  if (input.kind === "radius") {
    const { origin, radiusKm, segmentId, resultUf } = input.snapshot;
    const search: DiscoveryExportSearch = {
      kind: "RADIUS",
      radius_km: radiusKm,
      segment_id: present(segmentId),
      uf: present(resultUf),
    };
    if (origin.kind === "municipality") {
      search.origin_municipio_nome = origin.municipioNome;
      search.origin_uf = origin.uf;
    } else if (origin.kind === "cnpj") search.origin_cnpj = origin.cnpj;
    else if (origin.kind === "tom") search.origin_codigo_tom = origin.codigoTom;
    else if (origin.kind === "ibge") search.origin_codigo_ibge = origin.codigoIbge;
    else {
      search.origin_lat = origin.lat;
      search.origin_lon = origin.lon;
    }
    return search;
  }
  if (input.kind === "neighbors") {
    return {
      kind: "NEIGHBORS",
      cnpj_full: input.snapshot.cnpj,
      radius_km: input.snapshot.radiusKm,
      segment_id: present(input.snapshot.segmentId),
      uf: present(input.snapshot.resultUf),
    };
  }
  if (input.kind === "root") {
    return input.snapshot.identifier.kind === "cnpj"
      ? { kind: "ROOT_BRANCHES", cnpj: input.snapshot.identifier.cnpj }
      : { kind: "ROOT_BRANCHES", cnpj_root: input.snapshot.identifier.cnpjRoot };
  }
  if (input.kind === "group") {
    return { kind: "COMMERCIAL_GROUP", group_id: input.snapshot.groupId };
  }
  return { kind: "SIMILAR", cnpj_full: input.cnpjFull };
}

export function downloadDiscoveryExport(file: DiscoveryExportFile): void {
  const url = URL.createObjectURL(file.blob);
  let anchor: HTMLAnchorElement | null = null;
  try {
    anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.filename;
    document.body.append(anchor);
    anchor.click();
  } finally {
    anchor?.remove();
    URL.revokeObjectURL(url);
  }
}

export function publicDiscoveryExportError(code: string): string {
  const messages: Record<string, string> = {
    invalid_request: "A API rejeitou os critérios da exportação.",
    export_too_large:
      "O resultado excede o limite de exportação. Aplique filtros mais restritivos e tente novamente.",
    reference_not_found: "O estabelecimento de referência não foi encontrado.",
    origin_not_found: "A origem informada não foi encontrada.",
    origin_without_geo: "A origem informada não possui geografia disponível.",
    root_not_found: "A raiz informada não foi encontrada.",
    group_not_found: "O grupo comercial informado não foi encontrado.",
    group_without_members: "O grupo comercial não possui membros registrados.",
    database_unavailable: "O banco do Sentinel está indisponível.",
    base_setup_required: "A base do Sentinel ainda precisa ser preparada.",
    base_initializing: "A base do Sentinel ainda está sendo preparada.",
    base_unavailable: "A base do Sentinel está indisponível.",
    schema_not_current: "O schema do banco não corresponde a esta versão do Sentinel.",
    request_timeout: "A exportação excedeu o tempo limite. Tente novamente.",
    network_error: "Não foi possível conectar à API para exportar os resultados.",
    invalid_response: "A API retornou um arquivo de exportação inválido.",
  };
  return messages[code] ?? "Não foi possível exportar os resultados.";
}
