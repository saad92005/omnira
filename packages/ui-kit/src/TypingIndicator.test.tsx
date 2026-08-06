import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TypingIndicator } from "./TypingIndicator.js";

describe("TypingIndicator", () => {
  it("renders an accessible status announcing Omnira is typing", () => {
    render(<TypingIndicator />);
    expect(screen.getByRole("status")).toHaveAccessibleName("Omnira is typing");
  });
});
