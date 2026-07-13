import type {
  CommercialGroupFormValues,
  CommercialGroupSearchSnapshot,
  CommercialGroupValidationErrors,
} from "./commercialGroupTypes";

export function validateCommercialGroup(
  values: CommercialGroupFormValues,
): CommercialGroupValidationErrors {
  if (!values.groupId.trim()) {
    return { groupId: "Informe o ID do grupo." };
  }
  return {};
}

export function createCommercialGroupSnapshot(
  values: CommercialGroupFormValues,
): CommercialGroupSearchSnapshot {
  return { groupId: values.groupId.trim() };
}

export function publicCommercialGroupError(code: string): string {
  if (code === "group_not_found") {
    return "O grupo comercial informado não foi encontrado.";
  }
  if (code === "group_without_members") {
    return "O grupo existe, mas não possui raízes registradas.";
  }
  if (code === "invalid_request") {
    return "A API rejeitou os critérios da busca por grupo comercial.";
  }
  if (code === "database_unavailable") {
    return "A busca por grupo comercial não está disponível porque o banco do Sentinel está indisponível.";
  }
  if (code === "request_timeout") {
    return "A busca excedeu o tempo limite. Tente novamente.";
  }
  if (code === "invalid_response" || code === "invalid_json") {
    return "Resposta inválida da API. Tente novamente mais tarde.";
  }
  return "Não foi possível concluir a busca por grupo comercial. Verifique a conexão e tente novamente.";
}

export function commercialGroupRoleLabel(role: string): string {
  if (role === "MATRIZ") return "Matriz";
  if (role === "FILIAL") return "Filial";
  return "Desconhecido";
}

export function commercialGroupValue(value: string | null): string {
  return value === null || value === "" ? "—" : value;
}
