import type { RadiusSearchSnapshotOrigin } from "../../services/sentinelApi";
import type { RadiusSearchPage } from "../../types/api";

export type RadiusOriginKind =
  | "municipality"
  | "cnpj"
  | "tom"
  | "ibge"
  | "coordinates";

export interface RadiusFormValues {
  originKind: RadiusOriginKind;
  originMunicipioNome: string;
  originUf: string;
  originCnpj: string;
  originCodigoTom: string;
  originCodigoIbge: string;
  originLat: string;
  originLon: string;
  radiusKm: string;
  segmentId: string;
  resultUf: string;
}

export interface RadiusSearchSnapshot {
  origin: RadiusSearchSnapshotOrigin;
  radiusKm: number;
  segmentId: string;
  resultUf: string;
}

export type RadiusValidationErrors = Partial<
  Record<keyof RadiusFormValues, string>
>;

export type RadiusViewState =
  | { kind: "initial" }
  | { kind: "loading" }
  | { kind: "error"; code: string }
  | {
      kind: "success";
      page: RadiusSearchPage;
      snapshot: RadiusSearchSnapshot;
    };

export const EMPTY_RADIUS_FORM: RadiusFormValues = {
  originKind: "municipality",
  originMunicipioNome: "",
  originUf: "",
  originCnpj: "",
  originCodigoTom: "",
  originCodigoIbge: "",
  originLat: "",
  originLon: "",
  radiusKm: "",
  segmentId: "",
  resultUf: "",
};
