import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { logRequest, logSuccess, logError } from "./utils/logger";
logRequest("App initialization starting");

const rootElement = document.getElementById("root");
if (!rootElement) {
  logError("Root element not found");
} else {
  logSuccess("Root element retrieved");

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );

  const nodeEnv =
    import.meta.env?.NODE_ENV ??
    (typeof process !== "undefined" ? process.env?.NODE_ENV : undefined);
  logSuccess("Rendering started", { nodeEnv });
}
