import { Suspense, lazy } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { LayoutGroup } from "framer-motion";
import BackButton from "./components/BackButton";
import DarkModeToggle from "./components/DarkModeToggle";

const PanelGrid = lazy(() => import("./components/PanelGrid"));
const Read = lazy(() => import("./pages/Read"));
const Buy = lazy(() => import("./pages/Buy"));
const World = lazy(() => import("./pages/World"));
const Team = lazy(() => import("./pages/Team"));
const Contact = lazy(() => import("./pages/Contact"));

export default function App() {
  const location = useLocation();

  return (
    <div
      className="relative w-screen h-screen overflow-hidden border-4 p-4"
      style={{ borderColor: "var(--border)" }}
    >
      <LayoutGroup>
        <Suspense fallback={<div>Loading...</div>}>
          <Routes>
            <Route path="/" element={<PanelGrid />} />
            <Route path="/read" element={<Read />} />
            <Route path="/buy" element={<Buy />} />
            <Route path="/world" element={<World />} />
            <Route path="/team" element={<Team />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        <BackButton />
        <DarkModeToggle />
      </LayoutGroup>
    </div>
  );
}
