import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "style"> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  children: ReactNode;
}

export function Button({ variant = "primary", fullWidth, children, disabled, ...rest }: ButtonProps): ReactNode {
  return (
    <button
      {...rest}
      disabled={disabled}
      className={`omnira-btn omnira-btn--${variant}${fullWidth ? " omnira-btn--full" : ""}`}
    >
      {children}
    </button>
  );
}
