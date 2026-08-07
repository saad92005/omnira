import { useEffect, useRef, type ReactNode } from "react";

/**
 * A soft radial highlight that follows the pointer — writes --cursor-x/-y
 * as CSS custom properties on the element itself (rAF-throttled) rather
 * than driving React state, so it costs nothing per frame beyond a style
 * write. Render once at the app root, alongside AuroraBackground.
 */
export function CursorGlow(): ReactNode {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let frame = 0;
    let latestX = 0;
    let latestY = 0;
    let pending = false;

    function paint(): void {
      pending = false;
      ref.current?.style.setProperty("--cursor-x", `${latestX}px`);
      ref.current?.style.setProperty("--cursor-y", `${latestY}px`);
    }

    function onMove(event: PointerEvent): void {
      latestX = event.clientX;
      latestY = event.clientY;
      if (!pending) {
        pending = true;
        frame = requestAnimationFrame(paint);
      }
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  return <div ref={ref} className="omnira-cursor-glow" aria-hidden="true" />;
}
