import { describe, expect, it } from "vitest";
import { AGENT_PERSONAS, resolvePersonaPrompt } from "./personas.js";

describe("resolvePersonaPrompt", () => {
  it("returns undefined for the general persona (empty addition)", () => {
    expect(resolvePersonaPrompt("general")).toBeUndefined();
  });

  it("returns the persona's real prompt addition for a known id", () => {
    expect(resolvePersonaPrompt("coding")).toContain("Coding Helper");
  });

  it("returns undefined for an unknown id instead of throwing", () => {
    expect(resolvePersonaPrompt("not-a-real-persona")).toBeUndefined();
  });

  it("returns undefined when no id is given", () => {
    expect(resolvePersonaPrompt(undefined)).toBeUndefined();
  });

  it("every declared persona has a non-empty label and description", () => {
    for (const persona of AGENT_PERSONAS) {
      expect(persona.label.length).toBeGreaterThan(0);
      expect(persona.description.length).toBeGreaterThan(0);
    }
  });
});
