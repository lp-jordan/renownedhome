import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { LayoutGroup, AnimatePresence } from "framer-motion";
import { useEffect } from "react";

import { updatePreviousPathname } from "./utils/navigation";

import PanelGrid from "./components/PanelGrid";
import Read from "./pages/Read";
import IssueDetail from "./pages/IssueDetail";
import Buy from "./pages/Buy";
import Meet from "./pages/Meet";
import Connect from "./pages/Connect";
import Admin from "./pages/Admin";
import Breadcrumbs from "./components/Breadcrumbs";

export default function App() {
  const location = useLocation();

  useEffect(() => {
    updatePreviousPathname(location.pathname);
  }, [location.pathname]);

  return (
    <div className="relative fixed inset-0 overflow-hidden p-3 bg-[#fdfaf5]">
      <Breadcrumbs className="absolute top-6 left-6 z-10" />
      <LayoutGroup>
        <AnimatePresence mode="wait" initial={false}>
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<PanelGrid />} />
            <Route path="/read" element={<Read />} />
            <Route path="/read/:issueId" element={<IssueDetail />} />
            <Route path="/buy" element={<Buy />} />
            <Route path="/meet" element={<Meet />} />
            <Route path="/connect" element={<Connect />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </LayoutGroup>
    </div>
  );
}
