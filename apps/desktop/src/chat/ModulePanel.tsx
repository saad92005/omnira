import { X } from "lucide-react";
import { useEffect, type MouseEvent, type ReactNode } from "react";

export interface ModulePanelProps {
  title: string;
  icon: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

/** Centered glass modal (bottom sheet on narrow viewports) — Escape and backdrop click both close it. */
export function ModulePanel({ title, icon, onClose, children }: ModulePanelProps): ReactNode {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function stopPropagation(event: MouseEvent): void {
    event.stopPropagation();
  }

  return (
    <div className="omnira-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="omnira-modal omnira-glass omnira-hud-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={stopPropagation}
      >
        <div className="omnira-modal__header">
          <span className="omnira-modal__icon" aria-hidden="true">
            {icon}
          </span>
          <h2 className="omnira-modal__title">{title}</h2>
          <button type="button" className="omnira-modal__close" onClick={onClose} aria-label="Close">
            <X size={16} strokeWidth={2} />
          </button>
        </div>
        <div className="omnira-modal__body">{children}</div>
      </div>
    </div>
  );
}
