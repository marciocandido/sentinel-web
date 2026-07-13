import type {
  RootBranchesFormValues,
  RootBranchesSearchSnapshot,
  RootBranchesValidationErrors,
} from "./rootBranchesTypes";

export function validateRootBranches(
  values: RootBranchesFormValues,
): RootBranchesValidationErrors {
  if (!values.identifierValue.trim()) {
    return {
      identifierValue:
        values.identifierKind === "cnpj"
          ? "Informe o CNPJ completo."
          : "Informe a raiz do CNPJ.",
    };
  }
  return {};
}

export function createRootBranchesSnapshot(
  values: RootBranchesFormValues,
): RootBranchesSearchSnapshot {
  const identifierValue = values.identifierValue.trim();
  return values.identifierKind === "cnpj"
    ? { identifier: { kind: "cnpj", cnpj: identifierValue } }
    : { identifier: { kind: "root", cnpjRoot: identifierValue } };
}

export function publicRootBranchesError(code: string): string {
  if (code === "reference_not_found") {
    return "O estabelecimento de referência não foi encontrado na base útil.";
  }
  if (code === "root_not_found") {
    return "A raiz informada não foi encontrada na base útil.";
  }
  if (code === "invalid_request") {
    return "A API rejeitou os critérios da busca por raiz e filiais.";
  }
  if (code === "database_unavailable") {
    return "A busca por raiz e filiais não está disponível porque o banco do Sentinel está indisponível.";
  }
  if (code === "request_timeout") {
    return "A busca excedeu o tempo limite. Tente novamente.";
  }
  if (code === "invalid_response" || code === "invalid_json") {
    return "Resposta inválida da API. Tente novamente mais tarde.";
  }
  return "Não foi possível concluir a busca por raiz e filiais. Verifique a conexão e tente novamente.";
}

export function rootBranchRoleLabel(role: string): string {
  if (role === "MATRIZ") return "Matriz";
  if (role === "FILIAL") return "Filial";
  return "Desconhecido";
}

export function rootBranchValue(value: string | null): string {
  return value === null || value === "" ? "—" : value;
}
