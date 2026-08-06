import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { AuroraBackground } from "./AuroraBackground.js";

describe("AuroraBackground", () => {
  it("renders as decorative and hidden from assistive tech", () => {
    const { container } = render(<AuroraBackground />);
    const root = container.querySelector(".omnira-aurora-bg");
    expect(root).not.toBeNull();
    expect(root).toHaveAttribute("aria-hidden", "true");
  });
});
