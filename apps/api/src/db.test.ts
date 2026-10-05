import { describe, expect, it } from "vitest";
import { isNeonUrl } from "./db.js";

describe("isNeonUrl", () => {
  it("detects Neon-hosted databases", () => {
    expect(
      isNeonUrl("postgresql://u:p@ep-cool-name-123.us-east-2.aws.neon.tech/db?sslmode=require"),
    ).toBe(true);
  });

  it("treats local and self-hosted Postgres as plain TCP", () => {
    expect(isNeonUrl("postgresql://omnira:omnira@localhost:5432/omnira")).toBe(false);
    expect(isNeonUrl("postgresql://u:p@db.example.com:5432/app")).toBe(false);
  });

  it("does not throw on malformed input", () => {
    expect(isNeonUrl("not a url")).toBe(false);
  });
});
