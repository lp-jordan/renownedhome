import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { MediaProvider } from "./hooks/useMediaStore";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <MediaProvider>
        <App />
      </MediaProvider>
    </BrowserRouter>
  </React.StrictMode>
);
