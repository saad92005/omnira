import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "style"> {
  variant?: ButtonVariant;
  children: ReactNode;
}

export function Button({ variant = "primary", children, disabled, ...rest }: ButtonProps): ReactNode {
  return (
    <button {...rest} disabled={disabled} className={`omnira-btn omnira-btn--${variant}`}>
      {children}
    </button>
  );
}
