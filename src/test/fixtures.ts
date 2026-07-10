import type { DiscoveryEstablishment, DiscoveryEstablishmentPage } from "../types/api";

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
