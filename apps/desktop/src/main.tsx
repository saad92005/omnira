import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@omnira/ui-kit/tokens.css";
import { App } from "./App.js";

const container = document.getElementById("root");
if (!container) throw new Error("Root element #root was not found");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
