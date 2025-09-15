import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { LayoutGroup, AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

import { updatePreviousPathname } from "./utils/navigation";

import PanelGrid from "./components/PanelGrid";
import SplashScreen from "./components/SplashScreen";
import Read from "./pages/Read";
import IssueDetail from "./pages/IssueDetail";
import Buy from "./pages/Buy";
import Meet from "./pages/Meet";
import BioDetail from "./pages/BioDetail";
import Connect from "./pages/Connect";
import Admin from "./pages/Admin";
import Breadcrumbs from "./components/Breadcrumbs";
import splashContent from "../content/splash.json";

export default function App() {
  const location = useLocation();
  const { logoSrc } = splashContent;
  const [logoVisible, setLogoVisible] = useState(location.pathname !== "/");
  useEffect(() => {
    updatePreviousPathname(location.pathname);
  }, [location.pathname]);
  const scrollLocked = location.pathname === "/";

  return (
    <div
      className={`fixed inset-0 p-3 bg-[#fdfaf5] ${
        scrollLocked ? "overflow-hidden" : "overflow-y-auto"
      }`}
    >
      <header className="absolute top-3 left-6 right-6 z-10 flex items-center justify-between">
        <Breadcrumbs />
        <AnimatePresence>
          {logoVisible && (
            <motion.img
              key="corner-logo"
              src={logoSrc}
              alt="Renowned Home logo"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="h-8 w-auto"
            />
          )}
        </AnimatePresence>
      </header>
      <LayoutGroup>
        <div className="relative h-full">
          <AnimatePresence>
            <Routes location={location} key={location.pathname}>
              <Route
                path="/"
                element={
                  <Page>
                    <SplashScreen onDismiss={() => setLogoVisible(true)}>
                      <PanelGrid />
                    </SplashScreen>
                  </Page>
                }
              />
              <Route path="/read" element={<Page><Read /></Page>} />
              <Route path="/read/:issueId" element={<Page><IssueDetail /></Page>} />
              <Route path="/buy" element={<Page><Buy /></Page>} />
              <Route path="/meet" element={<Page><Meet /></Page>} />
              <Route path="/meet/:bioId" element={<Page><BioDetail /></Page>} />
              <Route path="/connect" element={<Page><Connect /></Page>} />
              <Route path="/admin" element={<Page><Admin /></Page>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AnimatePresence>
        </div>
      </LayoutGroup>
    </div>
  );
}

function Page({ children }) {
  return (
    <motion.div
      className="absolute inset-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
}
