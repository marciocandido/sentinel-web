import { describe, expect, it } from "vitest";
import type { RuntimeUpdateStage } from "../../types/api";
import { updateBlockerLabel, updateFailureLabel, updateStageLabel } from "./monthlyUpdatePresentation";

describe("monthly update presentation", () => {
  it("maps every public stage without exposing a backend value", () => {
    const stages: RuntimeUpdateStage[] = ["DISCOVERY", "DOWNLOAD", "PROCESSING", "VALIDATING_GENERATION", "LOADING_CANDIDATE", "VALIDATING_CANDIDATE", "CANDIDATE_READY", "PRE_PROMOTION_BACKUP", "PROMOTION_WAITING", "PROMOTING", "POST_PROMOTION_VALIDATION", "ROLLING_BACK", "SUCCEEDED", "ROLLED_BACK", "ROLLBACK_FAILED"];
    stages.forEach((stage) => expect(updateStageLabel(stage)).not.toBe(stage));
  });
  it("uses safe fallbacks for unknown blockers and failures", () => {
    expect(updateBlockerLabel("future_blocker")).toBe("A atualização não pode ser iniciada neste momento.");
    expect(updateFailureLabel("private_backend_detail")).toBe("A atualização da base não foi concluída.");
  });
});
