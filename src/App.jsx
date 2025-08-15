import { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import BackButton from "./components/BackButton";
import DarkModeToggle from "./components/DarkModeToggle";

const PanelGrid = lazy(() => import("./components/PanelGrid"));
const Read = lazy(() => import("./pages/Read"));
const Buy = lazy(() => import("./pages/Buy"));
const World = lazy(() => import("./pages/World"));
const Team = lazy(() => import("./pages/Team"));
const Contact = lazy(() => import("./pages/Contact"));

export default function App() {
  return (
    <div
      className="relative w-screen h-screen overflow-hidden border-4 p-4"
      style={{ borderColor: "var(--border)" }}
    >
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
    </div>
  );
}
