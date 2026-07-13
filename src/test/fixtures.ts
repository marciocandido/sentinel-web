import type {
  DiscoveryEstablishment,
  DiscoveryEstablishmentPage,
  SimilarCompany,
  SimilarCompanyPage,
  RadiusSearchEstablishment,
  RadiusSearchOrigin,
  RadiusSearchPage,
  RootBranchEstablishment,
  RootBranchesContext,
  RootBranchesPage,
  CommercialGroupContext,
  CommercialGroupKnownEstablishment,
  CommercialGroupPage,
  CommercialGroupUnknownRoot,
} from "../types/api";

export function commercialGroupContext(
  overrides: Partial<CommercialGroupContext> = {},
): CommercialGroupContext {
  return {
    group_id: "grupo-metal",
    name: "Grupo Metal",
    membership_scope: "REGISTERED",
    establishment_data_scope: "BASE_UTIL",
    ...overrides,
  };
}

export function commercialGroupKnownEstablishment(
  overrides: Partial<CommercialGroupKnownEstablishment> = {},
): CommercialGroupKnownEstablishment {
  return {
    ...establishment({
      cnpj_full: "00123456000195",
      cnpj_root: "00123456",
      codigo_tom: "0001",
      codigo_ibge: "0550308",
      cnae_principal: "0123456",
      capital_social: "0005000.50",
    }),
    group_id: "grupo-metal",
    cnpj_root: "00123456",
    relation_type: "registered",
    relation_source: "manual",
    confidence: "0.8200",
    establishment_known: true,
    cnpj_order: "0001",
    cnpj_dv: "95",
    matriz_filial: "1",
    establishment_role: "MATRIZ",
    situacao_cadastral: "02",
    data_inicio_atividade: "2019-01-01",
    commercial_status: "UNKNOWN",
    commercial_status_source: "none",
    is_erp_customer: false,
    is_unattended_branch: false,
    branch_group: "unknown",
    ...overrides,
  };
}

export function commercialGroupUnknownRoot(
  overrides: Partial<CommercialGroupUnknownRoot> = {},
): CommercialGroupUnknownRoot {
  return {
    group_id: "grupo-metal",
    cnpj_root: "00987654",
    relation_type: "registered",
    relation_source: "manual",
    confidence: "0.8200",
    establishment_known: false,
    cnpj_full: null,
    cnpj_order: null,
    cnpj_dv: null,
    razao_social: null,
    nome_fantasia: null,
    matriz_filial: null,
    establishment_role: null,
    uf: null,
    municipio_nome: null,
    codigo_tom: null,
    codigo_ibge: null,
    cnae_principal: null,
    matched_by_cnae_principal: false,
    matched_by_cnae_secundario: false,
    situacao_cadastral: null,
    data_inicio_atividade: null,
    porte_codigo: null,
    capital_social: null,
    location_precision: null,
    has_geo: false,
    commercial_status: "UNKNOWN",
    commercial_status_source: "none",
    is_erp_customer: false,
    is_unattended_branch: false,
    branch_group: "unknown",
    ...overrides,
  };
}

export function commercialGroupPage(
  items = [commercialGroupKnownEstablishment(), commercialGroupUnknownRoot()],
  pagination: Partial<CommercialGroupPage["pagination"]> = {},
  group: CommercialGroupContext = commercialGroupContext(),
): CommercialGroupPage {
  return {
    group,
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

export function rootBranchesContext(
  overrides: Partial<RootBranchesContext> = {},
): RootBranchesContext {
  return {
    cnpj_root: "00123456",
    reference_cnpj_full: "00123456000195",
    data_scope: "BASE_UTIL",
    ...overrides,
  };
}

export function rootBranchEstablishment(
  overrides: Partial<RootBranchEstablishment> = {},
): RootBranchEstablishment {
  return {
    ...establishment({
      cnpj_full: "00123456000195",
      cnpj_root: "00123456",
      codigo_tom: "0001",
      codigo_ibge: "0550308",
      cnae_principal: "0123456",
      porte_codigo: "03",
      capital_social: "0005000.50",
    }),
    cnpj_order: "0001",
    cnpj_dv: "95",
    matriz_filial: "1",
    establishment_role: "MATRIZ",
    situacao_cadastral: "02",
    data_inicio_atividade: "2019-01-01",
    is_erp_customer: false,
    is_unattended_branch: false,
    branch_group: "unknown",
    ...overrides,
  };
}

export function rootBranchesPage(
  items: RootBranchEstablishment[] = [rootBranchEstablishment()],
  pagination: Partial<RootBranchesPage["pagination"]> = {},
  root: RootBranchesContext = rootBranchesContext(),
): RootBranchesPage {
  return {
    root,
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
