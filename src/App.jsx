import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { LayoutGroup, AnimatePresence } from "framer-motion";

import PanelGrid from "./components/PanelGrid";
import Read from "./pages/Read";
import Buy from "./pages/Buy";
import Meet from "./pages/Meet";
import Connect from "./pages/Connect";

export default function App() {
  const location = useLocation();

  return (
    <div className="relative w-screen h-screen overflow-hidden p-3 bg-[#fdfaf5]">
      <LayoutGroup>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<PanelGrid />} />
            <Route path="/read" element={<Read />} />
            <Route path="/buy" element={<Buy />} />
            <Route path="/meet" element={<Meet />} />
            <Route path="/connect" element={<Connect />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </LayoutGroup>
    </div>
  );
}
