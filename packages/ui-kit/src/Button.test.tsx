import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Button } from "./Button.js";

describe("Button", () => {
  it("renders its children and responds to clicks", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Send</Button>);

    const button = screen.getByRole("button", { name: "Send" });
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("is not clickable while disabled", () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Send
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Send" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
