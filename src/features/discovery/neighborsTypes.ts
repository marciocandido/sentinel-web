import type { NeighborSearchPage } from "../../types/api";

export interface NeighborsFormValues {
  cnpj: string;
  radiusKm: string;
  segmentId: string;
  resultUf: string;
}

export interface NeighborsSearchSnapshot {
  cnpj: string;
  radiusKm: number;
  segmentId: string;
  resultUf: string;
}

export type NeighborsValidationErrors = Partial<Record<keyof NeighborsFormValues, string>>;

export type NeighborsViewState =
  | { kind: "initial" }
  | { kind: "loading" }
  | { kind: "error"; code: string }
  | { kind: "success"; page: NeighborSearchPage; snapshot: NeighborsSearchSnapshot };

export const EMPTY_NEIGHBORS_FORM: NeighborsFormValues = {
  cnpj: "",
  radiusKm: "30",
  segmentId: "",
  resultUf: "",
};
