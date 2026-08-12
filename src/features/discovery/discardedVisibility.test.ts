import { describe, expect, it } from "vitest";
import { EMPTY_COMMERCIAL_GROUP_FORM } from "./commercialGroupTypes";
import { createCommercialGroupSnapshot } from "./commercialGroupUtils";
import { EMPTY_FORM } from "./discoveryTypes";
import { createSnapshot } from "./discoveryUtils";
import { EMPTY_NEIGHBORS_FORM } from "./neighborsTypes";
import { createNeighborsSnapshot } from "./neighborsUtils";
import { EMPTY_RADIUS_FORM } from "./radiusTypes";
import { createRadiusSnapshot } from "./radiusUtils";
import { EMPTY_ROOT_BRANCHES_FORM } from "./rootBranchesTypes";
import { createRootBranchesSnapshot } from "./rootBranchesUtils";

describe("submitted discarded visibility snapshots", () => {
  it("captures false and true for every primary Discovery mode", () => {
    const standardValues = { ...EMPTY_FORM, segmentId: "metal", uf: "PR" };
    expect(createSnapshot("segment", standardValues).includeDiscarded).toBe(false);
    expect(createSnapshot("segment", standardValues, true).includeDiscarded).toBe(true);
    expect(createSnapshot("region", standardValues).includeDiscarded).toBe(false);
    expect(createSnapshot("region", standardValues, true).includeDiscarded).toBe(true);

    const radiusValues = {
      ...EMPTY_RADIUS_FORM,
      originMunicipioNome: "CURITIBA",
      originUf: "PR",
      radiusKm: "10",
    };
    expect(createRadiusSnapshot(radiusValues).includeDiscarded).toBe(false);
    expect(createRadiusSnapshot(radiusValues, true).includeDiscarded).toBe(true);

    expect(createNeighborsSnapshot(EMPTY_NEIGHBORS_FORM).includeDiscarded).toBe(false);
    expect(createNeighborsSnapshot(EMPTY_NEIGHBORS_FORM, true).includeDiscarded).toBe(true);
    expect(createRootBranchesSnapshot(EMPTY_ROOT_BRANCHES_FORM).includeDiscarded).toBe(false);
    expect(createRootBranchesSnapshot(EMPTY_ROOT_BRANCHES_FORM, true).includeDiscarded).toBe(true);
    expect(createCommercialGroupSnapshot(EMPTY_COMMERCIAL_GROUP_FORM).includeDiscarded).toBe(false);
    expect(createCommercialGroupSnapshot(EMPTY_COMMERCIAL_GROUP_FORM, true).includeDiscarded).toBe(true);
  });
});
