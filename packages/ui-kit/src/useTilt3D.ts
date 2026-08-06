import { useCallback, useRef, type PointerEvent, type RefObject } from "react";

export interface Tilt3DHandlers<T extends HTMLElement> {
  ref: RefObject<T>;
  onPointerMove: (event: PointerEvent<T>) => void;
  onPointerLeave: () => void;
}

/**
 * Cursor-tracked 3D tilt — sets --tilt-x/--tilt-y custom properties on the
 * element from pointer position, consumed by the `.omnira-tilt-3d` CSS
 * class (tokens.css). Kept as a hook rather than baked into a component so
 * any HUD panel can opt in with three props, no wrapper element required.
 */
export function useTilt3D<T extends HTMLElement>(maxDegrees = 6): Tilt3DHandlers<T> {
  const ref = useRef<T>(null);

  const onPointerMove = useCallback(
    (event: PointerEvent<T>) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      el.style.setProperty("--tilt-x", `${(px - 0.5) * 2 * maxDegrees}deg`);
      el.style.setProperty("--tilt-y", `${(0.5 - py) * 2 * maxDegrees}deg`);
    },
    [maxDegrees],
  );

  const onPointerLeave = useCallback(() => {
    ref.current?.style.setProperty("--tilt-x", "0deg");
    ref.current?.style.setProperty("--tilt-y", "0deg");
  }, []);

  return { ref, onPointerMove, onPointerLeave };
}
