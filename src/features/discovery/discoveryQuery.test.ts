import { describe, expect, it } from "vitest";
import { EMPTY_COMMERCIAL_GROUP_FORM } from "./commercialGroupTypes";
import {
  describeSearch,
  draftChanges,
  draftQueryKind,
  formatCapital,
  matchBadge,
  submittedSpec,
} from "./discoveryQuery";
import { EMPTY_FORM, type DiscoveryDraft, type DiscoverySubmission, type SubmittedQuery } from "./discoveryTypes";
import { EMPTY_NEIGHBORS_FORM } from "./neighborsTypes";
import { EMPTY_RADIUS_FORM } from "./radiusTypes";
import { EMPTY_ROOT_BRANCHES_FORM } from "./rootBranchesTypes";

const draft = (overrides: Partial<DiscoveryDraft> = {}): DiscoveryDraft => ({
  family: "filters",
  proximityType: "radius",
  structureType: "root",
  filters: EMPTY_FORM,
  radius: EMPTY_RADIUS_FORM,
  neighbors: EMPTY_NEIGHBORS_FORM,
  root: EMPTY_ROOT_BRANCHES_FORM,
  group: EMPTY_COMMERCIAL_GROUP_FORM,
  includeDiscarded: false,
  ...overrides,
});

const submission = (query: SubmittedQuery): DiscoverySubmission => ({
  id: 1,
  query,
  spec: submittedSpec(query),
  submittedAt: new Date("2026-09-26T14:32:00Z"),
});

describe("formatação sem coerção de identificadores", () => {
  it("formats textual capital for reading without numeric conversion", () => {
    expect(formatCapital("480000.00")).toBe("R$ 480.000,00");
    expect(formatCapital("0005000.5")).toBe("R$ 5.000,5");
    expect(formatCapital("1")).toBe("R$ 1");
    expect(formatCapital("12345678901234567890.99")).toBe("R$ 12.345.678.901.234.567.890,99");
    expect(formatCapital(null)).toBe("—");
    expect(formatCapital("abc")).toBe("abc");
  });

  it("labels CNAE correspondence only from API flags", () => {
    expect(matchBadge({ matched_by_cnae_principal: true, matched_by_cnae_secundario: false })).toBe("CNAE principal");
    expect(matchBadge({ matched_by_cnae_principal: false, matched_by_cnae_secundario: true })).toBe("via CNAE secundário");
    expect(matchBadge({ matched_by_cnae_principal: true, matched_by_cnae_secundario: true })).toBe("principal e secundário");
    expect(matchBadge({ matched_by_cnae_principal: false, matched_by_cnae_secundario: false })).toBeNull();
  });

  it("describes legacy and current definitions in operator language", () => {
    expect(describeSearch({ kind: "SEGMENT", segment_id: "metal", uf: "SP", porte_codigo: "03" }, () => "Metal-mecânica"))
      .toEqual([
        { key: "segmentId", label: "Segmento", value: "Metal-mecânica" },
        { key: "uf", label: "UF", value: "SP" },
        { key: "porteCodigo", label: "Porte", value: "03" },
      ]);
    expect(describeSearch({ kind: "RADIUS", radius_km: 12.5, origin_cnpj: "00ABC234000155" })).toEqual([
      { key: "origin", label: "Origem", value: "CNPJ 00ABC234000155" },
      { key: "radiusKm", label: "Raio", value: "12,5 km" },
      { key: "resultUf", label: "UF dos resultados", value: "todas" },
    ]);
  });
});

describe("draftChanges", () => {
  it("returns null without submission or when another family/type is visible", () => {
    expect(draftChanges(draft(), null)).toBeNull();
    const filtered = submission({ kind: "filtered", snapshot: { ...EMPTY_FORM, uf: "SP", includeDiscarded: false } });
    expect(draftChanges(draft({ family: "proximity" }), filtered)).toBeNull();
    const radius = submission({ kind: "radius", snapshot: { origin: { kind: "cnpj", cnpj: "00ABC" }, radiusKm: 10, segmentId: "", resultUf: "", includeDiscarded: false } });
    expect(draftQueryKind(draft({ family: "proximity", proximityType: "neighbors" }))).toBe("neighbors");
    expect(draftChanges(draft({ family: "proximity", proximityType: "neighbors" }), radius)).toBeNull();
  });

  it("reports submitted and current values per changed field, ignoring surrounding spaces", () => {
    const filtered = submission({ kind: "filtered", snapshot: { ...EMPTY_FORM, segmentId: "metal", uf: "SP", includeDiscarded: false } });
    expect(draftChanges(draft({ filters: { ...EMPTY_FORM, segmentId: " metal ", uf: "SP" } }), filtered)).toEqual([]);
    expect(draftChanges(draft({ filters: { ...EMPTY_FORM, segmentId: "metal", uf: "MG", capitalMin: "100" }, includeDiscarded: true }), filtered, () => "Metal"))
      .toEqual([
        { key: "uf", label: "UF", submitted: "SP", current: "MG" },
        { key: "capitalMin", label: "Capital mínimo", submitted: "—", current: "R$ 100" },
        { key: "includeDiscarded", label: "Descartados", submitted: "ocultos", current: "incluídos" },
      ]);
  });

  it("compares radius numerically and reports an origin type change once", () => {
    const radius = submission({ kind: "radius", snapshot: { origin: { kind: "cnpj", cnpj: "00ABC" }, radiusKm: 15, segmentId: "", resultUf: "", includeDiscarded: false } });
    const same = draft({ family: "proximity", radius: { ...EMPTY_RADIUS_FORM, originKind: "cnpj", originCnpj: "00ABC", radiusKm: "15.0", originMunicipioNome: "IGNORADO" } });
    expect(draftChanges(same, radius)).toEqual([]);
    const otherOrigin = draft({ family: "proximity", radius: { ...EMPTY_RADIUS_FORM, originKind: "tom", originCodigoTom: "0001", radiusKm: "20" } });
    expect(draftChanges(otherOrigin, radius)).toEqual([
      { key: "originKind", label: "Tipo de origem", submitted: "CNPJ", current: "Código TOM" },
    ]);
  });

  it("covers neighbors, root and group drafts", () => {
    const neighbors = submission({ kind: "neighbors", snapshot: { cnpj: "00ABC", radiusKm: 30, segmentId: "", resultUf: "", includeDiscarded: false } });
    expect(draftChanges(draft({ family: "proximity", proximityType: "neighbors", neighbors: { ...EMPTY_NEIGHBORS_FORM, cnpj: "00ABD", radiusKm: "30" } }), neighbors))
      .toEqual([{ key: "cnpj", label: "CNPJ de referência", submitted: "00ABC", current: "00ABD" }]);
    const root = submission({ kind: "root", snapshot: { identifier: { kind: "root", cnpjRoot: "00123456" }, includeDiscarded: false } });
    expect(draftChanges(draft({ family: "structure", root: { identifierKind: "cnpj", identifierValue: "00123456" } }), root))
      .toEqual([{ key: "identifierKind", label: "Identificar por", submitted: "Raiz do CNPJ", current: "CNPJ completo" }]);
    const group = submission({ kind: "group", snapshot: { groupId: "GRP-1", includeDiscarded: false } });
    expect(draftChanges(draft({ family: "structure", structureType: "group", group: { groupId: "GRP-2" } }), group))
      .toEqual([{ key: "groupId", label: "ID do grupo", submitted: "GRP-1", current: "GRP-2" }]);
  });
});
