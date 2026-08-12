import { afterEach, describe, expect, it, vi } from "vitest";
import {
  downloadDiscoveryExport,
  publicDiscoveryExportError,
  toDiscoveryExportSearch,
} from "./discoveryExport";

describe("Discovery export snapshots", () => {
  it("converts segment and region snapshots without pagination or identifier coercion", () => {
    const segment = toDiscoveryExportSearch({
      kind: "standard",
      snapshot: {
        mode: "segment",
        segmentId: "0123456",
        uf: "PR",
        codigoTom: "0001",
        porteCodigo: "03",
        capitalMin: "000100.50",
        capitalMax: "",
      },
    });
    expect(segment).toEqual({
      kind: "SEGMENT",
      segment_id: "0123456",
      uf: "PR",
      codigo_tom: "0001",
      porte_codigo: "03",
      capital_min: "000100.50",
      capital_max: undefined,
    });
    expect(segment).not.toHaveProperty("limit");
    expect(segment).not.toHaveProperty("offset");

    expect(toDiscoveryExportSearch({
      kind: "standard",
      snapshot: {
        mode: "region",
        segmentId: "0123456",
        uf: "PR",
        codigoTom: "0001",
        codigoIbge: "0410000",
        municipioNome: "CURITIBA",
      },
    })).toEqual({
      kind: "REGION",
      uf: "PR",
      codigo_tom: "0001",
      codigo_ibge: "0410000",
      municipio_nome: "CURITIBA",
      segment_id: "0123456",
    });
  });

  it.each([
    [{ kind: "municipality", municipioNome: "CURITIBA", uf: "PR" } as const, { origin_municipio_nome: "CURITIBA", origin_uf: "PR" }],
    [{ kind: "cnpj", cnpj: "00ABC123000100" } as const, { origin_cnpj: "00ABC123000100" }],
    [{ kind: "tom", codigoTom: "0001" } as const, { origin_codigo_tom: "0001" }],
    [{ kind: "ibge", codigoIbge: "0410000" } as const, { origin_codigo_ibge: "0410000" }],
    [{ kind: "coordinates", lat: -25.4, lon: -49.2 } as const, { origin_lat: -25.4, origin_lon: -49.2 }],
  ])("maps radius origin %s", (origin, expected) => {
    const search = toDiscoveryExportSearch({
      kind: "radius",
      snapshot: { origin, radiusKm: 12.5, segmentId: "0123456", resultUf: "SC" },
    });
    expect(search).toEqual(expect.objectContaining({
      kind: "RADIUS",
      radius_km: 12.5,
      segment_id: "0123456",
      uf: "SC",
      ...expected,
    }));
    expect(search).not.toHaveProperty("limit");
    expect(search).not.toHaveProperty("offset");
  });

  it("converts neighbors, both root identifiers, group and similar exactly", () => {
    expect(toDiscoveryExportSearch({
      kind: "neighbors",
      snapshot: { cnpj: "00ABC123000100", radiusKm: 30, segmentId: "0123456", resultUf: "PR" },
    })).toEqual({
      kind: "NEIGHBORS",
      cnpj_full: "00ABC123000100",
      radius_km: 30,
      segment_id: "0123456",
      uf: "PR",
    });
    expect(toDiscoveryExportSearch({
      kind: "root",
      snapshot: { identifier: { kind: "cnpj", cnpj: "00ABC123000100" } },
    })).toEqual({ kind: "ROOT_BRANCHES", cnpj: "00ABC123000100" });
    expect(toDiscoveryExportSearch({
      kind: "root",
      snapshot: { identifier: { kind: "root", cnpjRoot: "00123456" } },
    })).toEqual({ kind: "ROOT_BRANCHES", cnpj_root: "00123456" });
    expect(toDiscoveryExportSearch({
      kind: "group",
      snapshot: { groupId: "grupo-001" },
    })).toEqual({ kind: "COMMERCIAL_GROUP", group_id: "grupo-001" });
    expect(toDiscoveryExportSearch({
      kind: "similar",
      cnpjFull: "00ABC123000100",
    })).toEqual({ kind: "SIMILAR", cnpj_full: "00ABC123000100" });
  });
});

describe("Discovery export download", () => {
  afterEach(() => vi.restoreAllMocks());

  it("downloads the exact Blob and server filename, then revokes the temporary URL", () => {
    const blob = new Blob(["file"]);
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:sentinel");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    downloadDiscoveryExport({
      blob,
      filename: "sentinel-segment-20260812T015500Z.csv",
      format: "CSV",
    });
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:sentinel");
    expect(document.querySelector("a[download]")).toBeNull();
  });

  it("always revokes the URL if the browser click fails", () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:sentinel");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      throw new Error("synthetic click failure");
    });
    expect(() => downloadDiscoveryExport({
      blob: new Blob(),
      filename: "sentinel-segment-20260812T015500Z.csv",
      format: "CSV",
    })).toThrow("synthetic click failure");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:sentinel");
    expect(document.querySelector("a[download]")).toBeNull();
  });

  it("maps size and transport failures without exposing backend messages", () => {
    expect(publicDiscoveryExportError("export_too_large")).toMatch(/filtros mais restritivos/);
    expect(publicDiscoveryExportError("private_backend_code")).toBe(
      "Não foi possível exportar os resultados.",
    );
  });
});
