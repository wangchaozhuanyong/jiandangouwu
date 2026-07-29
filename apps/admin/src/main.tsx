import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

document.body.classList.add("cloudbridge-admin-document");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <div className="admin-surface">
      <App />
    </div>
  </StrictMode>,
);
