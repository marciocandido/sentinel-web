export interface LivenessResponse {
  status: "ok";
  service: "sentinel-api";
}

export interface SegmentCatalogItem {
  id: string;
  name: string;
}

export interface SegmentCatalogResponse {
  items: SegmentCatalogItem[];
}

export interface ApiErrorDetail {
  code: string;
  message: string;
}

export interface ApiErrorResponse {
  error: ApiErrorDetail;
}

export interface DiscoveryEstablishment {
  cnpj_full: string;
  cnpj_root: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  uf: string | null;
  municipio_nome: string | null;
  codigo_tom: string | null;
  codigo_ibge: string | null;
  cnae_principal: string | null;
  matched_by_cnae_principal: boolean;
  matched_by_cnae_secundario: boolean;
  location_precision: string | null;
  has_geo: boolean;
  porte_codigo: string | null;
  capital_social: string | null;
  commercial_status: "UNKNOWN";
  commercial_status_source: "none";
}

export interface PaginationMeta {
  limit: number;
  offset: number;
  returned: number;
  has_more: boolean;
}

export interface DiscoveryEstablishmentPage {
  items: DiscoveryEstablishment[];
  pagination: PaginationMeta;
}

export type SimilarityReason =
  | "same_cnae_principal"
  | "same_segment"
  | "same_uf"
  | "same_municipio"
  | "porte_equal_or_higher"
  | "capital_band"
  | "within_radius";

export interface SimilarCompany {
  reference_cnpj_root: string;
  cnpj_full: string;
  cnpj_root: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  uf: string | null;
  municipio_nome: string | null;
  codigo_tom: string | null;
  codigo_ibge: string | null;
  cnae_principal: string | null;
  porte_codigo: string | null;
  capital_social: string | null;
  location_precision: string | null;
  has_geo: boolean;
  distance_km: number | null;
  matched_same_cnae_principal: boolean;
  matched_same_segment: boolean;
  matched_same_uf: boolean;
  matched_same_municipio: boolean;
  matched_porte_equal_or_higher: boolean;
  matched_capital_band: boolean;
  similarity_rank: number;
  similarity_reasons: SimilarityReason[];
  commercial_status: "UNKNOWN";
  commercial_status_source: "none";
}

export interface SimilarCompanyPage {
  items: SimilarCompany[];
  pagination: PaginationMeta;
}

export type RadiusSearchOriginKind = "COORDINATE" | "CNPJ" | "MUNICIPALITY";

export interface RadiusSearchOrigin {
  kind: RadiusSearchOriginKind;
  cnpj_full: string | null;
  codigo_tom: string | null;
  codigo_ibge: string | null;
  municipio_nome: string | null;
  uf: string | null;
  latitude: number;
  longitude: number;
  location_precision: string;
}

export interface RadiusSearchEstablishment extends DiscoveryEstablishment {
  latitude: number;
  longitude: number;
  distance_km: number;
  location_precision: string;
  has_geo: true;
}

export interface RadiusSearchPage {
  origin: RadiusSearchOrigin;
  items: RadiusSearchEstablishment[];
  pagination: PaginationMeta;
}

export interface RootBranchesContext {
  cnpj_root: string;
  reference_cnpj_full: string | null;
  data_scope: "BASE_UTIL";
}

export type EstablishmentRole = "MATRIZ" | "FILIAL" | "UNKNOWN";

export interface RootBranchEstablishment extends DiscoveryEstablishment {
  cnpj_order: string;
  cnpj_dv: string;
  matriz_filial: string;
  establishment_role: EstablishmentRole;
  situacao_cadastral: string;
  data_inicio_atividade: string | null;
  is_erp_customer: false;
  is_unattended_branch: false;
  branch_group: "unknown";
}

export interface RootBranchesPage {
  root: RootBranchesContext;
  items: RootBranchEstablishment[];
  pagination: PaginationMeta;
}

export interface CommercialGroupContext {
  group_id: string;
  name: string | null;
  membership_scope: "REGISTERED";
  establishment_data_scope: "BASE_UTIL";
}

interface CommercialGroupAssociationBase {
  group_id: string;
  cnpj_root: string;
  relation_type: string;
  relation_source: string;
  confidence: string | null;
  commercial_status: "UNKNOWN";
  commercial_status_source: "none";
  is_erp_customer: false;
  is_unattended_branch: false;
  branch_group: "unknown";
}

export interface CommercialGroupKnownEstablishment
  extends CommercialGroupAssociationBase,
    DiscoveryEstablishment {
  establishment_known: true;
  cnpj_full: string;
  cnpj_order: string;
  cnpj_dv: string;
  matriz_filial: string;
  establishment_role: EstablishmentRole;
  situacao_cadastral: string | null;
  data_inicio_atividade: string | null;
}

export interface CommercialGroupUnknownRoot
  extends CommercialGroupAssociationBase {
  establishment_known: false;
  cnpj_full: null;
  cnpj_order: null;
  cnpj_dv: null;
  razao_social: null;
  nome_fantasia: null;
  matriz_filial: null;
  establishment_role: null;
  uf: null;
  municipio_nome: null;
  codigo_tom: null;
  codigo_ibge: null;
  cnae_principal: null;
  matched_by_cnae_principal: false;
  matched_by_cnae_secundario: false;
  situacao_cadastral: null;
  data_inicio_atividade: null;
  porte_codigo: null;
  capital_social: null;
  location_precision: null;
  has_geo: false;
}

export type CommercialGroupItem =
  | CommercialGroupKnownEstablishment
  | CommercialGroupUnknownRoot;

export interface CommercialGroupPage {
  group: CommercialGroupContext;
  items: CommercialGroupItem[];
  pagination: PaginationMeta;
}

const SIMILARITY_REASONS: readonly SimilarityReason[] = [
  "same_cnae_principal",
  "same_segment",
  "same_uf",
  "same_municipio",
  "porte_equal_or_higher",
  "capital_band",
  "within_radius",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isLivenessResponse(value: unknown): value is LivenessResponse {
  return isRecord(value) && value.status === "ok" && value.service === "sentinel-api";
}

export function isSegmentCatalogResponse(value: unknown): value is SegmentCatalogResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    value.items.every(
      (item) => isRecord(item) && typeof item.id === "string" && typeof item.name === "string",
    )
  );
}

export function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  return (
    isRecord(value) &&
    isRecord(value.error) &&
    typeof value.error.code === "string" &&
    typeof value.error.message === "string"
  );
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

export function isDiscoveryEstablishment(value: unknown): value is DiscoveryEstablishment {
  return (
    isRecord(value) &&
    typeof value.cnpj_full === "string" &&
    typeof value.cnpj_root === "string" &&
    isNullableString(value.razao_social) &&
    isNullableString(value.nome_fantasia) &&
    isNullableString(value.uf) &&
    isNullableString(value.municipio_nome) &&
    isNullableString(value.codigo_tom) &&
    isNullableString(value.codigo_ibge) &&
    isNullableString(value.cnae_principal) &&
    typeof value.matched_by_cnae_principal === "boolean" &&
    typeof value.matched_by_cnae_secundario === "boolean" &&
    isNullableString(value.location_precision) &&
    typeof value.has_geo === "boolean" &&
    isNullableString(value.porte_codigo) &&
    isNullableString(value.capital_social) &&
    value.commercial_status === "UNKNOWN" &&
    value.commercial_status_source === "none"
  );
}

export function isPaginationMeta(value: unknown): value is PaginationMeta {
  return (
    isRecord(value) &&
    Number.isInteger(value.limit) &&
    (value.limit as number) > 0 &&
    Number.isInteger(value.offset) &&
    (value.offset as number) >= 0 &&
    Number.isInteger(value.returned) &&
    (value.returned as number) >= 0 &&
    typeof value.has_more === "boolean"
  );
}

export function isDiscoveryEstablishmentPage(value: unknown): value is DiscoveryEstablishmentPage {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    value.items.every(isDiscoveryEstablishment) &&
    isPaginationMeta(value.pagination)
  );
}

export function isSimilarityReason(value: unknown): value is SimilarityReason {
  return typeof value === "string" && SIMILARITY_REASONS.includes(value as SimilarityReason);
}

export function isSimilarCompany(value: unknown): value is SimilarCompany {
  return (
    isRecord(value) &&
    typeof value.reference_cnpj_root === "string" &&
    typeof value.cnpj_full === "string" &&
    typeof value.cnpj_root === "string" &&
    isNullableString(value.razao_social) &&
    isNullableString(value.nome_fantasia) &&
    isNullableString(value.uf) &&
    isNullableString(value.municipio_nome) &&
    isNullableString(value.codigo_tom) &&
    isNullableString(value.codigo_ibge) &&
    isNullableString(value.cnae_principal) &&
    isNullableString(value.porte_codigo) &&
    isNullableString(value.capital_social) &&
    isNullableString(value.location_precision) &&
    typeof value.has_geo === "boolean" &&
    (value.distance_km === null ||
      (typeof value.distance_km === "number" &&
        Number.isFinite(value.distance_km) &&
        value.distance_km >= 0)) &&
    typeof value.matched_same_cnae_principal === "boolean" &&
    typeof value.matched_same_segment === "boolean" &&
    typeof value.matched_same_uf === "boolean" &&
    typeof value.matched_same_municipio === "boolean" &&
    typeof value.matched_porte_equal_or_higher === "boolean" &&
    typeof value.matched_capital_band === "boolean" &&
    Number.isInteger(value.similarity_rank) &&
    (value.similarity_rank as number) >= 1 &&
    (value.similarity_rank as number) <= 5 &&
    Array.isArray(value.similarity_reasons) &&
    value.similarity_reasons.every(isSimilarityReason) &&
    value.commercial_status === "UNKNOWN" &&
    value.commercial_status_source === "none"
  );
}

export function isSimilarCompanyPage(value: unknown): value is SimilarCompanyPage {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    value.items.every(isSimilarCompany) &&
    isPaginationMeta(value.pagination)
  );
}

function isCoordinate(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum;
}

export function isRadiusSearchOrigin(value: unknown): value is RadiusSearchOrigin {
  return (
    isRecord(value) &&
    (value.kind === "COORDINATE" || value.kind === "CNPJ" || value.kind === "MUNICIPALITY") &&
    isNullableString(value.cnpj_full) &&
    isNullableString(value.codigo_tom) &&
    isNullableString(value.codigo_ibge) &&
    isNullableString(value.municipio_nome) &&
    isNullableString(value.uf) &&
    isCoordinate(value.latitude, -90, 90) &&
    isCoordinate(value.longitude, -180, 180) &&
    typeof value.location_precision === "string"
  );
}

export function isRadiusSearchEstablishment(value: unknown): value is RadiusSearchEstablishment {
  const row = value as Record<string, unknown>;
  return (
    isDiscoveryEstablishment(value) &&
    isCoordinate(row.latitude, -90, 90) &&
    isCoordinate(row.longitude, -180, 180) &&
    typeof row.distance_km === "number" &&
    Number.isFinite(row.distance_km) &&
    row.distance_km >= 0 &&
    value.location_precision !== null &&
    value.has_geo === true
  );
}

export function isRadiusSearchPage(value: unknown): value is RadiusSearchPage {
  return (
    isRecord(value) &&
    isRadiusSearchOrigin(value.origin) &&
    Array.isArray(value.items) &&
    value.items.every(isRadiusSearchEstablishment) &&
    isPaginationMeta(value.pagination)
  );
}

export function isRootBranchesContext(
  value: unknown,
): value is RootBranchesContext {
  return (
    isRecord(value) &&
    typeof value.cnpj_root === "string" &&
    isNullableString(value.reference_cnpj_full) &&
    value.data_scope === "BASE_UTIL"
  );
}

export function isRootBranchEstablishment(
  value: unknown,
): value is RootBranchEstablishment {
  const row = value as Record<string, unknown>;
  return (
    isDiscoveryEstablishment(value) &&
    typeof row.cnpj_order === "string" &&
    typeof row.cnpj_dv === "string" &&
    typeof row.matriz_filial === "string" &&
    (row.establishment_role === "MATRIZ" ||
      row.establishment_role === "FILIAL" ||
      row.establishment_role === "UNKNOWN") &&
    typeof row.situacao_cadastral === "string" &&
    isNullableString(row.data_inicio_atividade) &&
    row.is_erp_customer === false &&
    row.is_unattended_branch === false &&
    row.branch_group === "unknown"
  );
}

export function isRootBranchesPage(value: unknown): value is RootBranchesPage {
  return (
    isRecord(value) &&
    isRootBranchesContext(value.root) &&
    Array.isArray(value.items) &&
    value.items.every(isRootBranchEstablishment) &&
    isPaginationMeta(value.pagination)
  );
}

export function isCommercialGroupContext(
  value: unknown,
): value is CommercialGroupContext {
  return (
    isRecord(value) &&
    typeof value.group_id === "string" &&
    isNullableString(value.name) &&
    value.membership_scope === "REGISTERED" &&
    value.establishment_data_scope === "BASE_UTIL"
  );
}

function isCommercialGroupConfidence(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== "string" || value.trim() === "") return false;
  const decimal = value.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(decimal)) return false;
  const parsed = Number(decimal);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1;
}

function isCommercialGroupAssociation(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.group_id === "string" &&
    typeof value.cnpj_root === "string" &&
    typeof value.relation_type === "string" &&
    value.relation_type.trim() !== "" &&
    typeof value.relation_source === "string" &&
    value.relation_source.trim() !== "" &&
    isCommercialGroupConfidence(value.confidence) &&
    value.commercial_status === "UNKNOWN" &&
    value.commercial_status_source === "none" &&
    value.is_erp_customer === false &&
    value.is_unattended_branch === false &&
    value.branch_group === "unknown"
  );
}

export function isCommercialGroupKnownEstablishment(
  value: unknown,
): value is CommercialGroupKnownEstablishment {
  const row = value as Record<string, unknown>;
  return (
    isCommercialGroupAssociation(value) &&
    isDiscoveryEstablishment(value) &&
    row.establishment_known === true &&
    typeof row.cnpj_order === "string" &&
    typeof row.cnpj_dv === "string" &&
    typeof row.matriz_filial === "string" &&
    (row.establishment_role === "MATRIZ" ||
      row.establishment_role === "FILIAL" ||
      row.establishment_role === "UNKNOWN") &&
    isNullableString(row.situacao_cadastral) &&
    isNullableString(row.data_inicio_atividade)
  );
}

export function isCommercialGroupUnknownRoot(
  value: unknown,
): value is CommercialGroupUnknownRoot {
  const row = value as Record<string, unknown>;
  return (
    isCommercialGroupAssociation(value) &&
    row.establishment_known === false &&
    row.cnpj_full === null &&
    row.cnpj_order === null &&
    row.cnpj_dv === null &&
    row.razao_social === null &&
    row.nome_fantasia === null &&
    row.matriz_filial === null &&
    row.establishment_role === null &&
    row.uf === null &&
    row.municipio_nome === null &&
    row.codigo_tom === null &&
    row.codigo_ibge === null &&
    row.cnae_principal === null &&
    row.matched_by_cnae_principal === false &&
    row.matched_by_cnae_secundario === false &&
    row.situacao_cadastral === null &&
    row.data_inicio_atividade === null &&
    row.porte_codigo === null &&
    row.capital_social === null &&
    row.location_precision === null &&
    row.has_geo === false
  );
}

export function isCommercialGroupItem(
  value: unknown,
): value is CommercialGroupItem {
  return (
    isCommercialGroupKnownEstablishment(value) ||
    isCommercialGroupUnknownRoot(value)
  );
}

export function isCommercialGroupPage(
  value: unknown,
): value is CommercialGroupPage {
  return (
    isRecord(value) &&
    isCommercialGroupContext(value.group) &&
    Array.isArray(value.items) &&
    value.items.every(isCommercialGroupItem) &&
    isPaginationMeta(value.pagination)
  );
}
