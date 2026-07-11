import type {
  DiscoveryFormValues,
  DiscoverySearchSnapshot,
  SearchMode,
  ValidationErrors,
} from "./discoveryTypes";
import type { DiscoveryEstablishment } from "../../types/api";

const DECIMAL_PATTERN = /^\d+(?:\.\d+)?$/;

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

export function validateSearch(mode: SearchMode, values: DiscoveryFormValues): ValidationErrors {
  const errors: ValidationErrors = {};
  if (mode === "segment" && !values.segmentId.trim()) {
    errors.segmentId = "Selecione um segmento para realizar a busca.";
  }
  for (const field of ["capitalMin", "capitalMax"] as const) {
    const value = values[field].trim();
    if (mode === "segment" && value && !DECIMAL_PATTERN.test(value)) {
      errors[field] = "Informe um valor decimal válido usando ponto como separador.";
    }
  }
  if (
    mode === "segment" &&
    !errors.capitalMin &&
    !errors.capitalMax &&
    values.capitalMin.trim() &&
    values.capitalMax.trim() &&
    compareDecimals(values.capitalMin.trim(), values.capitalMax.trim()) > 0
  ) {
    errors.capitalMax = "O capital máximo deve ser maior ou igual ao capital mínimo.";
  }
  if (
    mode === "region" &&
    ![values.uf, values.codigoTom, values.codigoIbge, values.municipioNome].some((value) => value.trim())
  ) {
    errors.region = "Informe ao menos UF, código TOM, código IBGE ou nome do município.";
  }
  return errors;
}

export function createSnapshot(
  mode: SearchMode,
  values: DiscoveryFormValues,
): DiscoverySearchSnapshot {
  const trimmed = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, value.trim()]),
  ) as unknown as DiscoveryFormValues;
  if (mode === "segment") {
    return {
      mode,
      segmentId: trimmed.segmentId,
      uf: trimmed.uf,
      codigoTom: trimmed.codigoTom,
      porteCodigo: trimmed.porteCodigo,
      capitalMin: trimmed.capitalMin,
      capitalMax: trimmed.capitalMax,
    };
  }
  return {
    mode,
    segmentId: trimmed.segmentId,
    uf: trimmed.uf,
    codigoTom: trimmed.codigoTom,
    codigoIbge: trimmed.codigoIbge,
    municipioNome: trimmed.municipioNome,
  };
}

export function publicSearchError(code: string): string {
  if (code === "database_unavailable") {
    return "A busca não está disponível porque o banco do Sentinel está indisponível.";
  }
  if (code === "invalid_request") {
    return "A API rejeitou os filtros informados. Revise os critérios e tente novamente.";
  }
  if (code === "request_timeout") {
    return "A busca excedeu o tempo limite. Tente novamente.";
  }
  if (code === "invalid_response" || code === "invalid_json") {
    return "Resposta inválida da API. Tente novamente mais tarde.";
  }
  return "Não foi possível concluir a busca. Verifique a conexão com a API e tente novamente.";
}

export function matchLabel(establishment: DiscoveryEstablishment): string {
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
