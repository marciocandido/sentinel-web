import type { DiscoveryEstablishmentPage } from "../../types/api";

export type SearchMode =
  | "segment"
  | "region"
  | "radius"
  | "neighbors"
  | "root"
  | "group";

export interface DiscoveryFormValues {
  segmentId: string;
  uf: string;
  codigoTom: string;
  codigoIbge: string;
  municipioNome: string;
  porteCodigo: string;
  capitalMin: string;
  capitalMax: string;
}

export type DiscoverySearchSnapshot =
  | {
      mode: "segment";
      segmentId: string;
      uf: string;
      codigoTom: string;
      porteCodigo: string;
      capitalMin: string;
      capitalMax: string;
      includeDiscarded: boolean;
    }
  | {
      mode: "region";
      segmentId: string;
      uf: string;
      codigoTom: string;
      codigoIbge: string;
      municipioNome: string;
      includeDiscarded: boolean;
    };

export type ValidationErrors = Partial<Record<keyof DiscoveryFormValues | "region", string>>;

export type DiscoveryViewState =
  | { kind: "initial" }
  | { kind: "loading" }
  | { kind: "success"; page: DiscoveryEstablishmentPage; snapshot: DiscoverySearchSnapshot }
  | { kind: "error"; code: string };

export const EMPTY_FORM: DiscoveryFormValues = {
  segmentId: "",
  uf: "",
  codigoTom: "",
  codigoIbge: "",
  municipioNome: "",
  porteCodigo: "",
  capitalMin: "",
  capitalMax: "",
};
