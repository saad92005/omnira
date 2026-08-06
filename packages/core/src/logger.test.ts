import { describe, expect, it } from "vitest";
import { getCorrelationId, withCorrelationId } from "./logger.js";

describe("withCorrelationId", () => {
  it("makes the correlation ID available inside the callback", () => {
    withCorrelationId(() => {
      expect(getCorrelationId()).toBe("fixed-id");
    }, "fixed-id");
  });

  it("generates a correlation ID when none is supplied", () => {
    withCorrelationId(() => {
      expect(getCorrelationId()).toBeTypeOf("string");
      expect(getCorrelationId()?.length).toBeGreaterThan(0);
    });
  });

  it("does not leak a correlation ID outside its scope", () => {
    withCorrelationId(() => {
      /* noop */
    }, "scoped-id");
    expect(getCorrelationId()).toBeUndefined();
  });

  it("isolates correlation IDs across concurrent async contexts", async () => {
    const results: string[] = [];
    await Promise.all([
      withCorrelationId(async () => {
        await new Promise((r) => setTimeout(r, 10));
        results.push(getCorrelationId() ?? "missing");
      }, "id-a"),
      withCorrelationId(async () => {
        results.push(getCorrelationId() ?? "missing");
      }, "id-b"),
    ]);
    expect(results.sort()).toEqual(["id-a", "id-b"]);
  });
});
