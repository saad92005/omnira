import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "style"> {
  variant?: ButtonVariant;
  children: ReactNode;
}

const VARIANT_STYLE: Record<ButtonVariant, CSSProperties> = {
  primary: {
    background: "var(--omnira-accent)",
    color: "var(--omnira-accent-contrast)",
    border: "1px solid transparent",
  },
  secondary: {
    background: "transparent",
    color: "var(--omnira-text-primary)",
    border: "1px solid var(--omnira-border)",
  },
  danger: {
    background: "var(--omnira-danger)",
    color: "var(--omnira-accent-contrast)",
    border: "1px solid transparent",
  },
};

export function Button({ variant = "primary", children, disabled, ...rest }: ButtonProps): ReactNode {
  return (
    <button
      {...rest}
      disabled={disabled}
      style={{
        ...VARIANT_STYLE[variant],
        fontFamily: "var(--omnira-font-sans)",
        fontSize: "var(--omnira-text-sm)",
        padding: "var(--omnira-space-2) var(--omnira-space-4)",
        borderRadius: 8,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "background var(--omnira-transition-fast), opacity var(--omnira-transition-fast)",
      }}
    >
      {children}
    </button>
  );
}
