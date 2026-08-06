import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// @testing-library/react's auto-cleanup only registers itself when `afterEach`
// is a real global; vitest's `test.globals` is off here, so wire it up by hand
// — without this, unmounted components from a prior test leak into the next.
afterEach(() => {
  cleanup();
});
