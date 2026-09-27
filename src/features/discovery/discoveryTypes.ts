import type {
  CommercialGroupPage,
  DiscoveryEstablishmentPage,
  NeighborSearchPage,
  RadiusSearchPage,
  RootBranchesPage,
} from "../../types/api";
import type { DiscoverySearchSpec } from "../../services/sentinelApi";
import type { CommercialGroupFormValues, CommercialGroupSearchSnapshot } from "./commercialGroupTypes";
import type { NeighborsFormValues, NeighborsSearchSnapshot } from "./neighborsTypes";
import type { RadiusFormValues, RadiusSearchSnapshot } from "./radiusTypes";
import type { RootBranchesFormValues, RootBranchesSearchSnapshot } from "./rootBranchesTypes";

/** As três famílias visíveis ao operador. */
export type DiscoveryFamily = "filters" | "proximity" | "structure";
export type ProximityType = "radius" | "neighbors";
export type StructureType = "root" | "group";

/** Contrato efetivamente executado por uma consulta. */
export type QueryKind = "filtered" | ProximityType | StructureType;

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

/** Snapshot imutável de uma submissão da família Filtros (kind FILTERED). */
export interface FilteredSearchSnapshot extends DiscoveryFormValues {
  includeDiscarded: boolean;
}

export type ValidationErrors = Partial<Record<keyof DiscoveryFormValues | "filters", string>>;

/** Rascunho editável: um por família, preservado ao trocar de família. */
export interface DiscoveryDraft {
  family: DiscoveryFamily;
  proximityType: ProximityType;
  structureType: StructureType;
  filters: DiscoveryFormValues;
  radius: RadiusFormValues;
  neighbors: NeighborsFormValues;
  root: RootBranchesFormValues;
  group: CommercialGroupFormValues;
  includeDiscarded: boolean;
}

export type SubmittedQuery =
  | { kind: "filtered"; snapshot: FilteredSearchSnapshot }
  | { kind: "radius"; snapshot: RadiusSearchSnapshot }
  | { kind: "neighbors"; snapshot: NeighborsSearchSnapshot }
  | { kind: "root"; snapshot: RootBranchesSearchSnapshot }
  | { kind: "group"; snapshot: CommercialGroupSearchSnapshot };

/**
 * Consulta submetida. É imutável até uma nova busca e é a única fonte de
 * resultados, paginação, retry, exportação, pesquisa salva e lista de trabalho.
 */
export interface DiscoverySubmission {
  id: number;
  query: SubmittedQuery;
  /** Mesma definição enviada a exportação, pesquisa salva e worklist. */
  spec: DiscoverySearchSpec;
  submittedAt: Date;
}

export type QueryResult =
  | { kind: "filtered"; snapshot: FilteredSearchSnapshot; page: DiscoveryEstablishmentPage }
  | { kind: "radius"; snapshot: RadiusSearchSnapshot; page: RadiusSearchPage }
  | { kind: "neighbors"; snapshot: NeighborsSearchSnapshot; page: NeighborSearchPage }
  | { kind: "root"; snapshot: RootBranchesSearchSnapshot; page: RootBranchesPage }
  | { kind: "group"; snapshot: CommercialGroupSearchSnapshot; page: CommercialGroupPage };

export type ResultsState =
  | { kind: "initial" }
  | { kind: "loading" }
  | { kind: "success"; result: QueryResult }
  | { kind: "error"; code: string }
  | { kind: "cancelled" };

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
