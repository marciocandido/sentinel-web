import type { RootBranchesIdentifier } from "../../services/sentinelApi";

export type RootBranchesIdentifierKind = "cnpj" | "root";

export interface RootBranchesFormValues {
  identifierKind: RootBranchesIdentifierKind;
  identifierValue: string;
}

export interface RootBranchesSearchSnapshot {
  identifier: RootBranchesIdentifier;
  includeDiscarded: boolean;
}

export type RootBranchesValidationErrors = Partial<
  Record<keyof RootBranchesFormValues, string>
>;

export const EMPTY_ROOT_BRANCHES_FORM: RootBranchesFormValues = {
  identifierKind: "cnpj",
  identifierValue: "",
};
