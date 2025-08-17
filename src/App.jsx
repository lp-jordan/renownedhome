import { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { LayoutGroup } from "framer-motion";

const PanelGrid = lazy(() => import("./components/PanelGrid"));
const Read = lazy(() => import("./pages/Read"));
const Buy = lazy(() => import("./pages/Buy"));
const World = lazy(() => import("./pages/World"));
const Meet = lazy(() => import("./pages/Meet"));
const Reach = lazy(() => import("./pages/Reach"));

export default function App() {
  return (
    <div
      className="relative w-screen h-screen overflow-x-hidden overflow-y-auto border-4 p-4"
      style={{ borderColor: "var(--border)" }}
    >
      <LayoutGroup>
        <Suspense fallback={<div>Loading...</div>}>
          <Routes>
            <Route path="/" element={<PanelGrid />} />
            <Route path="/read" element={<Read />} />
            <Route path="/buy" element={<Buy />} />
            <Route path="/world" element={<World />} />
            <Route path="/meet" element={<Meet />} />
            <Route path="/reach" element={<Reach />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </LayoutGroup>
    </div>
  );
}
