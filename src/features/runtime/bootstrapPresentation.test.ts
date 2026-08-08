import { describe, expect, it } from "vitest";
import { competenceLabel, formatBytes, progressPair, progressUnitLabel, shardPair } from "./bootstrapPresentation";

describe("bootstrap presentation", () => {
  it("formats binary bytes and preserves null as unknown", () => {
    expect(formatBytes(1024 ** 4, "Não informado")).toBe("1 TiB");
    expect(formatBytes(null, "Não informado")).toBe("Não informado");
  });

  it("accepts only real monthly competence labels", () => {
    expect(competenceLabel("2026-07")).toBe("2026-07");
    expect(competenceLabel("2026-00")).toBe("Não confirmada");
    expect(competenceLabel("2026-13")).toBe("Não confirmada");
  });

  it("reads only valid public progress pairs, shards and units", () => {
    expect(progressPair({ completed: 10, total: 20 }, "completed", "total")).toEqual([10, 20]);
    expect(progressPair({ completed: 21, total: 20 }, "completed", "total")).toBeNull();
    expect(shardPair({ shard_index: 8, shard_total: 20 })).toEqual([8, 20]);
    expect(shardPair({ shard_index: 0, shard_total: 20 })).toBeNull();
    expect(progressUnitLabel("rows")).toBe("registros");
    expect(progressUnitLabel("private-unit")).toBeNull();
  });
});
