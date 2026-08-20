import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { DocumentationPage } from "./components/DocumentationPage";
import "./styles.css";

const root = document.getElementById("docs-root");

if (root === null) {
  throw new Error("MeterMesh could not find the documentation root element.");
}

createRoot(root).render(
  <StrictMode>
    <DocumentationPage />
  </StrictMode>,
);
