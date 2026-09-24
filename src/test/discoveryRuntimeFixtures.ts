// Payloads derivados das respostas reais do runtime integrado que reproduziram
// a issue #50 (região, raio e vizinhos com origem em Campinas/SP, raio 10 km).
// CNPJs e razões sociais foram substituídos por valores sintéticos; forma,
// tipos e geometria foram preservados: todos os itens compartilham o centroide
// municipal da origem, com distance_km 0 e precisão MUNICIPIO.
import type {
  DiscoveryEstablishment,
  DiscoveryEstablishmentPage,
  NeighborEstablishment,
  NeighborSearchPage,
  RadiusSearchEstablishment,
  RadiusSearchOrigin,
  RadiusSearchPage,
} from "../types/api";

const CENTROID = { latitude: -22.882283, longitude: -47.045306 };

const location = {
  uf: "SP",
  municipio_nome: "CAMPINAS",
  codigo_tom: "6291",
  codigo_ibge: "3509502",
};

const identities = [
  { cnpj_full: "00A00001000160", cnpj_root: "00A00001", razao_social: "00.A00.001 EMPRESA INDIVIDUAL SINTETICA", nome_fantasia: null },
  { cnpj_full: "00A00002000120", cnpj_root: "00A00002", razao_social: "00.A00.002 PRESTADOR SINTETICO", nome_fantasia: null },
  { cnpj_full: "00A00003000175", cnpj_root: "00A00003", razao_social: "019 REGIAO SINTETICA SERVICOS LTDA", nome_fantasia: "010 FANTASIA SINTETICA" },
];

const matches = [
  { cnae_principal: "4399103", matched_by_cnae_principal: false, matched_by_cnae_secundario: true },
  { cnae_principal: "4321500", matched_by_cnae_principal: true, matched_by_cnae_secundario: false },
  { cnae_principal: "6821801", matched_by_cnae_principal: false, matched_by_cnae_secundario: true },
];

const company = [
  { porte_codigo: "01", capital_social: "10000.00" },
  { porte_codigo: "01", capital_social: "5000.00" },
  { porte_codigo: "03", capital_social: "10000.00" },
];

const status = {
  commercial_status: "UNKNOWN",
  commercial_status_source: "none",
} as const;

const pagination = { limit: 3, offset: 0, returned: 3, has_more: true };

export function runtimeRegionPage(): DiscoveryEstablishmentPage {
  const items: DiscoveryEstablishment[] = identities.map((identity, index) => ({
    ...identity,
    ...location,
    ...matches[index],
    location_precision: "MUNICIPIO",
    has_geo: true,
    ...company[index],
    ...status,
  }));
  return { items, pagination: { ...pagination } };
}

export function runtimeRadiusOrigin(
  overrides: Partial<RadiusSearchOrigin> = {},
): RadiusSearchOrigin {
  return {
    kind: "MUNICIPALITY",
    cnpj_full: null,
    ...location,
    ...CENTROID,
    location_precision: "MUNICIPIO",
    ...overrides,
  };
}

export function runtimeRadiusPage(
  origin: RadiusSearchOrigin = runtimeRadiusOrigin(),
): RadiusSearchPage {
  const items: RadiusSearchEstablishment[] = identities.map((identity, index) => ({
    ...identity,
    ...location,
    ...CENTROID,
    distance_km: 0,
    location_precision: "MUNICIPIO",
    has_geo: true,
    ...matches[index],
    ...company[index],
    ...status,
  }));
  return { origin, items, pagination: { ...pagination } };
}

export function runtimeNeighborsPage(): NeighborSearchPage {
  const items: NeighborEstablishment[] = [identities[0], identities[2]].map(
    (identity, index) => ({
      ...identity,
      ...location,
      ...CENTROID,
      distance_km: 0,
      location_precision: "MUNICIPIO",
      has_geo: true,
      ...matches[index * 2],
      ...status,
    }),
  );
  return {
    origin: runtimeRadiusOrigin({ kind: "CNPJ", cnpj_full: identities[1].cnpj_full }),
    items,
    pagination: { limit: 3, offset: 0, returned: 2, has_more: true },
  };
}
