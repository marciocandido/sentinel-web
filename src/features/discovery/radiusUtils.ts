import type {
  RadiusFormValues,
  RadiusSearchSnapshot,
  RadiusValidationErrors,
} from "./radiusTypes";

const DECIMAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

function numeric(value: string): number | null {
  const text = value.trim();
  if (!DECIMAL.test(text)) return null;
  const result = Number(text);
  return Number.isFinite(result) ? result : null;
}

export function validateRadius(
  values: RadiusFormValues,
): RadiusValidationErrors {
  const errors: RadiusValidationErrors = {};

  if (values.originKind === "municipality") {
    if (!values.originMunicipioNome.trim()) {
      errors.originMunicipioNome = "Informe o município de origem.";
    }
    if (!values.originUf.trim()) {
      errors.originUf = "Informe a UF da origem.";
    }
  }
  if (values.originKind === "cnpj" && !values.originCnpj.trim()) {
    errors.originCnpj = "Informe o CNPJ de origem.";
  }
  if (values.originKind === "tom" && !values.originCodigoTom.trim()) {
    errors.originCodigoTom = "Informe o código TOM da origem.";
  }
  if (values.originKind === "ibge" && !values.originCodigoIbge.trim()) {
    errors.originCodigoIbge = "Informe o código IBGE da origem.";
  }
  if (values.originKind === "coordinates") {
    const latitude = numeric(values.originLat);
    const longitude = numeric(values.originLon);
    if (latitude === null || latitude < -90 || latitude > 90) {
      errors.originLat = "Informe latitude finita entre -90 e 90.";
    }
    if (longitude === null || longitude < -180 || longitude > 180) {
      errors.originLon = "Informe longitude finita entre -180 e 180.";
    }
  }

  const radius = numeric(values.radiusKm);
  if (radius === null || radius <= 0) {
    errors.radiusKm = "Informe um raio finito maior que zero.";
  }
  return errors;
}

export function createRadiusSnapshot(
  values: RadiusFormValues,
): RadiusSearchSnapshot {
  const text = (value: string) => value.trim();
  const radiusKm = numeric(values.radiusKm)!;
  let origin: RadiusSearchSnapshot["origin"];

  if (values.originKind === "municipality") {
    origin = {
      kind: "municipality",
      municipioNome: text(values.originMunicipioNome),
      uf: text(values.originUf),
    };
  } else if (values.originKind === "cnpj") {
    origin = { kind: "cnpj", cnpj: text(values.originCnpj) };
  } else if (values.originKind === "tom") {
    origin = { kind: "tom", codigoTom: text(values.originCodigoTom) };
  } else if (values.originKind === "ibge") {
    origin = { kind: "ibge", codigoIbge: text(values.originCodigoIbge) };
  } else {
    origin = {
      kind: "coordinates",
      lat: numeric(values.originLat)!,
      lon: numeric(values.originLon)!,
    };
  }

  return {
    origin,
    radiusKm,
    segmentId: text(values.segmentId),
    resultUf: text(values.resultUf),
  };
}

export function publicRadiusError(code: string): string {
  if (code === "origin_not_found") {
    return "A origem informada não foi encontrada.";
  }
  if (code === "origin_without_geo") {
    return "A origem informada não possui geografia disponível.";
  }
  if (code === "invalid_request") {
    return "A API rejeitou os critérios da busca por raio. Revise os campos.";
  }
  if (code === "database_unavailable") {
    return "A busca por raio não está disponível porque o banco do Sentinel está indisponível.";
  }
  if (code === "request_timeout") {
    return "A busca excedeu o tempo limite. Tente novamente.";
  }
  if (code === "invalid_response" || code === "invalid_json") {
    return "Resposta inválida da API. Tente novamente mais tarde.";
  }
  return "Não foi possível concluir a busca por raio. Verifique a conexão e tente novamente.";
}
