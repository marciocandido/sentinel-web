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
  includeDiscarded: boolean;
}

export type NeighborsValidationErrors = Partial<Record<keyof NeighborsFormValues, string>>;

export const EMPTY_NEIGHBORS_FORM: NeighborsFormValues = {
  cnpj: "",
  radiusKm: "30",
  segmentId: "",
  resultUf: "",
};
