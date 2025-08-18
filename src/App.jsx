import { Routes, Route, Navigate } from "react-router-dom";
import { LayoutGroup } from "framer-motion";

import PanelGrid from "./components/PanelGrid";
import Read from "./pages/Read";
import Buy from "./pages/Buy";
import World from "./pages/World";
import Meet from "./pages/Meet";
import Reach from "./pages/Reach";

export default function App() {
  return (
    <div
      className="relative w-screen h-screen overflow-x-hidden overflow-y-auto border-4 p-4"
      style={{ borderColor: "var(--border)" }}
    >
      <LayoutGroup>
        <Routes>
          <Route path="/" element={<PanelGrid />} />
          <Route path="/read" element={<Read />} />
          <Route path="/buy" element={<Buy />} />
          <Route path="/world" element={<World />} />
          <Route path="/meet" element={<Meet />} />
          <Route path="/reach" element={<Reach />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </LayoutGroup>
    </div>
  );
}
