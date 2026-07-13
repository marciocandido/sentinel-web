import type { SimilarityReason } from "../../types/api";

const REASON_LABELS: Record<SimilarityReason, string> = {
  same_cnae_principal: "Mesmo CNAE principal",
  same_segment: "Mesmo segmento",
  same_uf: "Mesma UF",
  same_municipio: "Mesmo município",
  porte_equal_or_higher: "Porte igual ou superior",
  capital_band: "Faixa de capital compatível",
  within_radius: "Dentro do raio",
};

export function similarityReasonLabel(reason: SimilarityReason): string {
  return REASON_LABELS[reason];
}

export function similarValue(value: string | null): string {
  return value && value.length > 0 ? value : "—";
}

export function publicSimilarError(code: string): string {
  if (code === "reference_not_found") {
    return "O estabelecimento de referência não foi encontrado.";
  }
  if (code === "invalid_request") {
    return "Este estabelecimento não possui dados suficientes para comparação.";
  }
  if (code === "database_unavailable") {
    return "A consulta de semelhantes não está disponível porque o banco do Sentinel está indisponível.";
  }
  if (code === "request_timeout") {
    return "A consulta excedeu o tempo limite. Tente novamente.";
  }
  if (code === "invalid_response" || code === "invalid_json") {
    return "Resposta inválida da API. Tente novamente mais tarde.";
  }
  return "Não foi possível consultar empresas semelhantes. Verifique a conexão e tente novamente.";
}
