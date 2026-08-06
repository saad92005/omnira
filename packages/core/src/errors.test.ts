import { describe, expect, it } from "vitest";
import { NotFoundError, ValidationError, toOmniraError } from "./errors.js";

describe("OmniraError", () => {
  it("builds a standard envelope with code, message, and requestId", () => {
    const err = new NotFoundError("user not found", { userId: "abc" });
    const envelope = err.toEnvelope("req-123");

    expect(envelope).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "user not found",
        details: { userId: "abc" },
        requestId: "req-123",
      },
    });
  });

  it("omits details when none were provided", () => {
    const err = new ValidationError("bad input");
    const envelope = err.toEnvelope("req-456");

    expect(envelope.error.details).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(envelope.error, "details")).toBe(false);
  });

  it("carries the correct HTTP status per error type", () => {
    expect(new NotFoundError("x").httpStatus).toBe(404);
    expect(new ValidationError("x").httpStatus).toBe(400);
  });
});

describe("toOmniraError", () => {
  it("passes an existing OmniraError through unchanged", () => {
    const original = new ValidationError("bad input");
    expect(toOmniraError(original)).toBe(original);
  });

  it("wraps a plain Error as an InternalError, preserving its message", () => {
    const wrapped = toOmniraError(new Error("boom"));
    expect(wrapped.code).toBe("INTERNAL_ERROR");
    expect(wrapped.message).toBe("boom");
  });

  it("wraps a non-Error thrown value by stringifying it", () => {
    const wrapped = toOmniraError("just a string");
    expect(wrapped.message).toBe("just a string");
  });
});
