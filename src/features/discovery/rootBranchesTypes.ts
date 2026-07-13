import type { RootBranchesIdentifier } from "../../services/sentinelApi";
import type { RootBranchesPage } from "../../types/api";

export type RootBranchesIdentifierKind = "cnpj" | "root";

export interface RootBranchesFormValues {
  identifierKind: RootBranchesIdentifierKind;
  identifierValue: string;
}

export interface RootBranchesSearchSnapshot {
  identifier: RootBranchesIdentifier;
}

export type RootBranchesValidationErrors = Partial<
  Record<keyof RootBranchesFormValues, string>
>;

export type RootBranchesViewState =
  | { kind: "initial" }
  | { kind: "loading" }
  | { kind: "error"; code: string }
  | {
      kind: "success";
      page: RootBranchesPage;
      snapshot: RootBranchesSearchSnapshot;
    };

export const EMPTY_ROOT_BRANCHES_FORM: RootBranchesFormValues = {
  identifierKind: "cnpj",
  identifierValue: "",
};
