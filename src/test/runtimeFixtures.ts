import type { RuntimeBase, RuntimeComponent, RuntimeStatusResponse, RuntimeUpdate } from "../types/api";

type ComponentOverrides = Partial<Record<"api" | "database" | "worker", Partial<RuntimeComponent>>>;
type RuntimeOverrides = Partial<Omit<RuntimeStatusResponse, "components" | "base" | "update">> & {
  components?: ComponentOverrides;
  base?: Partial<RuntimeBase>;
  update?: Partial<RuntimeUpdate>;
};

export function runtimeBase(overrides: Partial<RuntimeBase> = {}): RuntimeBase {
  return {
    state: "READY",
    active_competence: "2026-07",
    previous_competence: null,
    available_competence: null,
    preparing_competence: null,
    action_required: null,
    current_stage: null,
    progress: null,
    last_failure_code: null,
    last_failure_message: null,
    update_policy: "NOTIFY_ONLY",
    last_metadata_check_at: null,
    last_metadata_check_result: "UP_TO_DATE",
    last_metadata_check_error: null,
    active_operation: null,
    ...overrides,
  };
}

export function runtimeUpdate(overrides: Partial<RuntimeUpdate> = {}): RuntimeUpdate {
  return {
    job_id: null,
    status: null,
    stage: null,
    progress: null,
    target_competence: null,
    failure_code: null,
    failure_message: null,
    active_competence_at_start: null,
    pre_promotion_backup_id: null,
    authorized_at: null,
    started_at: null,
    finished_at: null,
    promoted_at: null,
    rolled_back_at: null,
    ...overrides,
  };
}

export function runtimeStatus(overrides: RuntimeOverrides = {}): RuntimeStatusResponse {
  const { components, base, update, ...root } = overrides;
  const component = (state: RuntimeComponent["state"], schema_current: boolean | null): RuntimeComponent => ({ state, schema_current, last_seen_at: null });
  return {
    observed_at: "2026-08-07T19:43:22Z",
    summary: "AVAILABLE",
    ...root,
    components: {
      api: { ...component("AVAILABLE", null), ...components?.api },
      database: { ...component("AVAILABLE", true), ...components?.database },
      worker: { ...component("IDLE", null), ...components?.worker },
    },
    base: runtimeBase(base),
    update: runtimeUpdate(update),
  };
}
