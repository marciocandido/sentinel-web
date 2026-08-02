import { describe, expect, it } from "vitest";
import {
  isFeedbackCreateResponse,
  isFeedbackEvent,
  isFeedbackHistoryPage,
} from "./api";
import { feedbackReferenceOrNull } from "../features/discovery/feedbackUtils";

const event = {
  event_id: "9c3d2478-7db9-4b61-b9ea-2efdb88b14c7",
  cnpj_full: "00ABC234000155",
  action: "USEFUL",
  actor_id: "local-operator",
  source: { kind: "NEIGHBORS", reference: "00ABC234000155" },
  occurred_at: "2026-08-01T18:00:00Z",
};

describe("feedback API guards", () => {
  it("normalizes only compatible source references", () => {
    expect(feedbackReferenceOrNull("grupo-metal")).toBe("grupo-metal");
    expect(feedbackReferenceOrNull("grupo/metal:sp")).toBe("grupo/metal:sp");
    expect(feedbackReferenceOrNull(" grupo-metal ")).toBe("grupo-metal");
    expect(feedbackReferenceOrNull("Grupo Metal")).toBeNull();
    expect(feedbackReferenceOrNull("grupo@metal")).toBeNull();
    expect(feedbackReferenceOrNull("")).toBeNull();
    expect(feedbackReferenceOrNull("a".repeat(129))).toBeNull();
  });

  it("accepts the strict valid create response and history page", () => {
    expect(isFeedbackCreateResponse({ event, idempotent_replay: false })).toBe(true);
    expect(isFeedbackHistoryPage({
      cnpj_full: event.cnpj_full,
      actor_id: "local-operator",
      items: [event],
      pagination: { limit: 20, offset: 0, returned: 1, has_more: false },
    })).toBe(true);
  });

  it.each([
    ["invalid UUID", { ...event, event_id: "not-a-uuid" }],
    ["non-text CNPJ", { ...event, cnpj_full: 123 }],
    ["unknown action", { ...event, action: "WON" }],
    ["empty actor", { ...event, actor_id: " " }],
    ["invalid source", { ...event, source: { kind: "ERP", reference: null } }],
    ["empty source reference", { ...event, source: { kind: "SEGMENT", reference: "" } }],
    ["long source reference", { ...event, source: { kind: "SEGMENT", reference: "a".repeat(129) } }],
    ["incompatible source reference", { ...event, source: { kind: "SEGMENT", reference: "Grupo Metal" } }],
    ["timestamp without timezone", { ...event, occurred_at: "2026-08-01T18:00:00" }],
    ["forbidden commercial field", { ...event, commercial_status: "WON" }],
  ])("rejects %s", (_label, invalid) => {
    expect(isFeedbackEvent(invalid)).toBe(false);
  });

  it("rejects coercive replay flags and invalid pagination", () => {
    expect(isFeedbackCreateResponse({ event, idempotent_replay: "false" })).toBe(false);
    expect(isFeedbackHistoryPage({
      cnpj_full: event.cnpj_full,
      actor_id: event.actor_id,
      items: [],
      pagination: { limit: 20, offset: 0, returned: 0, has_more: "false" },
    })).toBe(false);
  });
});
