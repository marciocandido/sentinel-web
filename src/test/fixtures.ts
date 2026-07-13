import type {
  DiscoveryEstablishment,
  DiscoveryEstablishmentPage,
  SimilarCompany,
  SimilarCompanyPage,
  RadiusSearchEstablishment,
  RadiusSearchOrigin,
  RadiusSearchPage,
} from "../types/api";

export function establishment(
  overrides: Partial<DiscoveryEstablishment> = {},
): DiscoveryEstablishment {
  return {
    cnpj_full: "00123456000195",
    cnpj_root: "00123456",
    razao_social: "EMPRESA EXEMPLO LTDA",
    nome_fantasia: "EXEMPLO",
    uf: "SP",
    municipio_nome: "SAO PAULO",
    codigo_tom: "7107",
    codigo_ibge: "3550308",
    cnae_principal: "2511000",
    matched_by_cnae_principal: true,
    matched_by_cnae_secundario: false,
    location_precision: "MUNICIPIO",
    has_geo: true,
    porte_codigo: "03",
    capital_social: "500000.00",
    commercial_status: "UNKNOWN",
    commercial_status_source: "none",
    ...overrides,
  };
}

export function radiusSearchOrigin(overrides: Partial<RadiusSearchOrigin> = {}): RadiusSearchOrigin {
  return { kind: "MUNICIPALITY", cnpj_full: null, codigo_tom: "7107", codigo_ibge: "3550308", municipio_nome: "SAO PAULO", uf: "SP", latitude: -23.55, longitude: -46.63, location_precision: "MUNICIPIO", ...overrides };
}

export function radiusSearchEstablishment(overrides: Partial<RadiusSearchEstablishment> = {}): RadiusSearchEstablishment {
  return { ...establishment(), latitude: -23.54, longitude: -46.62, distance_km: 3.25, location_precision: "MUNICIPIO", has_geo: true, ...overrides };
}

export function radiusSearchPage(items: RadiusSearchEstablishment[] = [radiusSearchEstablishment()], pagination: Partial<RadiusSearchPage["pagination"]> = {}, origin: RadiusSearchOrigin = radiusSearchOrigin()): RadiusSearchPage {
  return { origin, items, pagination: { limit: 50, offset: 0, returned: items.length, has_more: false, ...pagination } };
}

export function discoveryPage(
  items: DiscoveryEstablishment[] = [establishment()],
  pagination: Partial<DiscoveryEstablishmentPage["pagination"]> = {},
): DiscoveryEstablishmentPage {
  return {
    items,
    pagination: {
      limit: 50,
      offset: 0,
      returned: items.length,
      has_more: false,
      ...pagination,
    },
  };
}

export function similarCompany(overrides: Partial<SimilarCompany> = {}): SimilarCompany {
  return {
    reference_cnpj_root: "00123456",
    cnpj_full: "00987654000110",
    cnpj_root: "00987654",
    razao_social: "EMPRESA SEMELHANTE LTDA",
    nome_fantasia: "SEMELHANTE",
    uf: "SP",
    municipio_nome: "SAO PAULO",
    codigo_tom: "7107",
    codigo_ibge: "3550308",
    cnae_principal: "2511000",
    porte_codigo: "03",
    capital_social: "500000.00",
    location_precision: "MUNICIPIO",
    has_geo: true,
    distance_km: null,
    matched_same_cnae_principal: true,
    matched_same_segment: true,
    matched_same_uf: true,
    matched_same_municipio: true,
    matched_porte_equal_or_higher: true,
    matched_capital_band: true,
    similarity_rank: 1,
    similarity_reasons: [
      "same_cnae_principal",
      "same_segment",
      "same_uf",
      "same_municipio",
      "porte_equal_or_higher",
      "capital_band",
    ],
    commercial_status: "UNKNOWN",
    commercial_status_source: "none",
    ...overrides,
  };
}

export function similarCompanyPage(
  items: SimilarCompany[] = [similarCompany()],
  pagination: Partial<SimilarCompanyPage["pagination"]> = {},
): SimilarCompanyPage {
  return {
    items,
    pagination: {
      limit: 25,
      offset: 0,
      returned: items.length,
      has_more: false,
      ...pagination,
    },
  };
}
