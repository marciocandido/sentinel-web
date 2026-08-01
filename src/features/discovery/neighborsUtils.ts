import type { NeighborsFormValues, NeighborsSearchSnapshot, NeighborsValidationErrors } from "./neighborsTypes";

const DECIMAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

function radius(value: string): number | null {
  const text = value.trim();
  if (!DECIMAL.test(text)) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export function validateNeighbors(values: NeighborsFormValues): NeighborsValidationErrors {
  const errors: NeighborsValidationErrors = {};
  if (!values.cnpj.trim()) errors.cnpj = "Informe o CNPJ de referência.";
  const parsedRadius = radius(values.radiusKm);
  if (parsedRadius === null || parsedRadius <= 0) {
    errors.radiusKm = "Informe um raio finito maior que zero.";
  }
  return errors;
}

export function createNeighborsSnapshot(values: NeighborsFormValues): NeighborsSearchSnapshot {
  return {
    cnpj: values.cnpj.trim(),
    radiusKm: radius(values.radiusKm)!,
    segmentId: values.segmentId.trim(),
    resultUf: values.resultUf.trim(),
  };
}

export function publicNeighborsError(code: string): string {
  if (code === "invalid_request") return "Revise o CNPJ, o raio e os filtros informados.";
  if (code === "origin_not_found") return "O estabelecimento de referência não foi encontrado na base útil.";
  if (code === "origin_without_geo") return "O estabelecimento de referência não possui localização disponível.";
  if (code === "database_unavailable") return "A base do Sentinel está temporariamente indisponível.";
  if (code === "invalid_response" || code === "invalid_json") return "A API retornou uma resposta inválida.";
  return "Não foi possível conectar ao Sentinel.";
}
