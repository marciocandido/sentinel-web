export interface CommercialGroupFormValues {
  groupId: string;
}

export interface CommercialGroupSearchSnapshot {
  groupId: string;
  includeDiscarded: boolean;
}

export type CommercialGroupValidationErrors = Partial<
  Record<keyof CommercialGroupFormValues, string>
>;

export const EMPTY_COMMERCIAL_GROUP_FORM: CommercialGroupFormValues = {
  groupId: "",
};
