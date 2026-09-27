import type {
  DiscoveryFormValues,
  FilteredSearchSnapshot,
  ValidationErrors,
} from "./discoveryTypes";
import type { DiscoveryEstablishment } from "../../types/api";

const DECIMAL_PATTERN = /^\d+(?:\.\d+)?$/;

/** Filtros materiais aceitos pelo backend FILTERED (#207). */
export const MATERIAL_FILTERS: ReadonlyArray<keyof DiscoveryFormValues> = [
  "segmentId",
  "uf",
  "municipioNome",
  "codigoTom",
  "codigoIbge",
  "porteCodigo",
  "capitalMin",
  "capitalMax",
];

function compareDecimals(left: string, right: string): number {
  const [leftInteger, leftFraction = ""] = left.split(".");
  const [rightInteger, rightFraction = ""] = right.split(".");
  const normalizedLeft = leftInteger.replace(/^0+(?=\d)/, "");
  const normalizedRight = rightInteger.replace(/^0+(?=\d)/, "");
  if (normalizedLeft.length !== normalizedRight.length) {
    return normalizedLeft.length > normalizedRight.length ? 1 : -1;
  }
  if (normalizedLeft !== normalizedRight) return normalizedLeft > normalizedRight ? 1 : -1;
  const width = Math.max(leftFraction.length, rightFraction.length);
  const paddedLeft = leftFraction.padEnd(width, "0");
  const paddedRight = rightFraction.padEnd(width, "0");
  if (paddedLeft === paddedRight) return 0;
  return paddedLeft > paddedRight ? 1 : -1;
}

/**
 * Valida apenas o que é obviamente inválido para a busca FILTERED: nenhum
 * filtro material, decimal malformado e capital mínimo maior que o máximo.
 * Qualquer combinação de filtros é enviada por AND; o backend é a autoridade.
 */
export function validateFilters(values: DiscoveryFormValues): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!MATERIAL_FILTERS.some((field) => values[field].trim())) {
    errors.filters = "Informe ao menos um filtro: segmento, UF, município, código TOM ou IBGE, porte ou capital.";
  }
  for (const field of ["capitalMin", "capitalMax"] as const) {
    const value = values[field].trim();
    if (value && !DECIMAL_PATTERN.test(value)) {
      errors[field] = "Informe um valor decimal válido usando ponto como separador.";
    }
  }
  if (
    !errors.capitalMin &&
    !errors.capitalMax &&
    values.capitalMin.trim() &&
    values.capitalMax.trim() &&
    compareDecimals(values.capitalMin.trim(), values.capitalMax.trim()) > 0
  ) {
    errors.capitalMax = "O capital máximo deve ser maior ou igual ao capital mínimo.";
  }
  return errors;
}

export function trimFilters(values: DiscoveryFormValues): DiscoveryFormValues {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, value.trim()]),
  ) as unknown as DiscoveryFormValues;
}

export function createFilteredSnapshot(
  values: DiscoveryFormValues,
  includeDiscarded = false,
): FilteredSearchSnapshot {
  return { ...trimFilters(values), includeDiscarded };
}

export const TIMEOUT_MESSAGE =
  "A busca excedeu o tempo limite. Nada foi perdido: tentar de novo repete exatamente a consulta submetida.";

export function publicSearchError(code: string): string {
  if (code === "database_unavailable") {
    return "A busca não está disponível porque o banco do Sentinel está indisponível.";
  }
  if (code === "invalid_request") {
    return "A API rejeitou os filtros informados. Revise os critérios e tente novamente.";
  }
  if (code === "request_timeout") return TIMEOUT_MESSAGE;
  if (code === "invalid_response" || code === "invalid_json") {
    return "Resposta inválida da API. Tente novamente mais tarde.";
  }
  return "Não foi possível concluir a busca. Verifique a conexão com a API e tente novamente.";
}

export function matchLabel(establishment: Pick<DiscoveryEstablishment, "matched_by_cnae_principal" | "matched_by_cnae_secundario">): string {
  if (establishment.matched_by_cnae_principal && establishment.matched_by_cnae_secundario) {
    return "Principal e secundário";
  }
  if (establishment.matched_by_cnae_principal) return "CNAE principal";
  if (establishment.matched_by_cnae_secundario) return "CNAE secundário";
  return "—";
}

export function detailValue(value: string | null): string {
  return value === null || value === "" ? "—" : value;
}
