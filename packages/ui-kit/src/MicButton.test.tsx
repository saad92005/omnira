import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MicButton } from "./MicButton.js";

describe("MicButton", () => {
  it("fires press-start and press-end handlers on pointer down/up", () => {
    const onPressStart = vi.fn();
    const onPressEnd = vi.fn();
    render(<MicButton state="idle" onPressStart={onPressStart} onPressEnd={onPressEnd} />);

    const button = screen.getByRole("button");
    fireEvent.pointerDown(button);
    expect(onPressStart).toHaveBeenCalledOnce();

    fireEvent.pointerUp(button);
    expect(onPressEnd).toHaveBeenCalledOnce();
  });

  it("labels the disabled state with the reason, never color alone", () => {
    render(
      <MicButton
        state="idle"
        disabled
        disabledReason="Microphone permission not granted"
        onPressStart={vi.fn()}
        onPressEnd={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Microphone permission not granted" })).toBeDisabled();
  });

  it("does not fire press handlers while disabled", () => {
    const onPressStart = vi.fn();
    render(<MicButton state="idle" disabled onPressStart={onPressStart} onPressEnd={vi.fn()} />);

    fireEvent.pointerDown(screen.getByRole("button"));
    expect(onPressStart).not.toHaveBeenCalled();
  });
});
