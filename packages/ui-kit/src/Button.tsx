import { useState, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "style"> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  children: ReactNode;
}

interface Ripple {
  id: number;
  x: number;
  y: number;
  size: number;
}

let rippleSeq = 0;

export function Button({ variant = "primary", fullWidth, children, disabled, onClick, ...rest }: ButtonProps): ReactNode {
  const [ripples, setRipples] = useState<Ripple[]>([]);

  function handleClick(event: MouseEvent<HTMLButtonElement>): void {
    const rect = event.currentTarget.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.8;
    const id = ++rippleSeq;
    setRipples((prev) => [...prev, { id, x: event.clientX - rect.left - size / 2, y: event.clientY - rect.top - size / 2, size }]);
    window.setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 650);
    onClick?.(event);
  }

  return (
    <button
      {...rest}
      disabled={disabled}
      onClick={disabled ? onClick : handleClick}
      className={`omnira-btn omnira-btn--${variant}${fullWidth ? " omnira-btn--full" : ""}`}
    >
      {children}
      {ripples.map((r) => (
        <span
          key={r.id}
          className="omnira-btn__ripple"
          aria-hidden="true"
          style={{ left: r.x, top: r.y, width: r.size, height: r.size }}
        />
      ))}
    </button>
  );
}
