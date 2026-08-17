import type { DiscoverySearchSpec } from "../../services/sentinelApi";

export const worklistSearchKindLabel: Record<DiscoverySearchSpec["kind"], string> = {
  SEGMENT: "Segmento",
  REGION: "Região",
  RADIUS: "Raio",
  NEIGHBORS: "Vizinhos",
  ROOT_BRANCHES: "Raiz/filiais",
  COMMERCIAL_GROUP: "Grupo comercial",
  SIMILAR: "Semelhantes",
};

export function publicWorklistError(code: string): string {
  const messages: Record<string, string> = {
    invalid_request: "A API rejeitou os dados da lista de trabalho.",
    worklist_empty: "A busca não possui estabelecimentos elegíveis para criar a lista.",
    worklist_too_large: "O resultado excede o limite permitido para uma lista de trabalho.",
    worklist_not_found: "Esta lista de trabalho já não existe.",
    worklist_name_conflict: "Já existe uma lista com esse nome.",
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
    internal_server_error: "Não foi possível concluir a operação.",
    request_timeout: "A operação excedeu o tempo limite.",
    network_error: "Não foi possível conectar à API.",
    invalid_response: "A API retornou uma resposta inválida.",
  };
  return messages[code] ?? "Não foi possível concluir a operação.";
}

export function worklistCreatedAt(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
