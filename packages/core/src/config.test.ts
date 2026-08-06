import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "./config.js";

const validEnv = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/omnira",
  JWT_ACCESS_SECRET: "a".repeat(32),
  JWT_REFRESH_SECRET: "b".repeat(32),
};

describe("loadConfig", () => {
  it("loads valid config and applies defaults", () => {
    const config = loadConfig(validEnv);
    expect(config.NODE_ENV).toBe("development");
    expect(config.LOG_LEVEL).toBe("info");
    expect(config.API_PORT).toBe(4000);
    expect(config.DATABASE_URL).toBe(validEnv.DATABASE_URL);
  });

  it("fails loudly with the specific missing variable when required config is absent", () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
    try {
      loadConfig({});
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      expect((err as ConfigError).message).toContain("DATABASE_URL");
      expect((err as ConfigError).message).toContain("JWT_ACCESS_SECRET");
    }
  });

  it("rejects a JWT secret that's too short rather than silently accepting a weak one", () => {
    expect(() => loadConfig({ ...validEnv, JWT_ACCESS_SECRET: "too-short" })).toThrow(ConfigError);
  });

  it("coerces API_PORT from a string env var to a number", () => {
    const config = loadConfig({ ...validEnv, API_PORT: "8080" });
    expect(config.API_PORT).toBe(8080);
  });

  it("defaults SYSTEM_CONTROL_AVAILABLE to true, and coerces the string 'false' to disable it", () => {
    expect(loadConfig(validEnv).SYSTEM_CONTROL_AVAILABLE).toBe(true);
    expect(loadConfig({ ...validEnv, SYSTEM_CONTROL_AVAILABLE: "false" }).SYSTEM_CONTROL_AVAILABLE).toBe(false);
  });

  it("prefers the host-assigned PORT over API_PORT, and doesn't leak PORT itself into the config", () => {
    const config = loadConfig({ ...validEnv, API_PORT: "4000", PORT: "10000" });
    expect(config.API_PORT).toBe(10000);
    expect(config).not.toHaveProperty("PORT");
  });
});
