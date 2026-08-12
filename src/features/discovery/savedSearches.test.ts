import { describe, expect, it } from "vitest";
import { toEditableDiscoverySearch } from "./savedSearches";

describe("toEditableDiscoverySearch", () => {
  it("rehydrates a radius municipality without coercing textual identifiers", () => {
    expect(toEditableDiscoverySearch({ kind:"RADIUS", origin_municipio_nome:"CURITIBA", origin_uf:"PR", radius_km:30, segment_id:"00123456", include_discarded:true })).toMatchObject({ mode:"radius", includeDiscarded:true, values:{ originKind:"municipality", segmentId:"00123456" } });
  });
  it("rejects ambiguous and drawer-only definitions", () => {
    expect(toEditableDiscoverySearch({ kind:"RADIUS", origin_cnpj:"00ABC", origin_codigo_tom:"001", radius_km:30 })).toBeNull();
    expect(toEditableDiscoverySearch({ kind:"SIMILAR", cnpj_full:"00ABC" })).toBeNull();
  });
});
