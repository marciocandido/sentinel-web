import type { CommercialGroupPage } from "../../types/api";

export interface CommercialGroupFormValues {
  groupId: string;
}

export interface CommercialGroupSearchSnapshot {
  groupId: string;
}

export type CommercialGroupValidationErrors = Partial<
  Record<keyof CommercialGroupFormValues, string>
>;

export type CommercialGroupViewState =
  | { kind: "initial" }
  | { kind: "loading" }
  | { kind: "error"; code: string }
  | {
      kind: "success";
      page: CommercialGroupPage;
      snapshot: CommercialGroupSearchSnapshot;
    };

export const EMPTY_COMMERCIAL_GROUP_FORM: CommercialGroupFormValues = {
  groupId: "",
};
