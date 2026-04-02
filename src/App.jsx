import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { api } from "./lib/api";
import AdminPage from "./components/AdminPage";
import PublicSite from "./components/PublicSite";

export default function App() {
  const [bootstrap, setBootstrap] = useState(null);
  const [session, setSession] = useState({ authenticated: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refreshBootstrap() {
    const next = await api.getBootstrap();
    setBootstrap(next);
    return next;
  }

  async function refreshSession() {
    const next = await api.getSession();
    setSession(next);
    return next;
  }

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [nextBootstrap, nextSession] = await Promise.all([
          api.getBootstrap(),
          api.getSession(),
        ]);
        setBootstrap(nextBootstrap);
        setSession(nextSession);
      } catch (loadError) {
        setError(loadError.message || "Unable to load the site.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return <div className="state-shell">Loading Renowned...</div>;
  }

  if (error || !bootstrap) {
    return <div className="state-shell">{error || "Bootstrap failed."}</div>;
  }

  return (
    <Routes>
      <Route
        path="/admin"
        element={
          <AdminPage
            bootstrap={bootstrap}
            refreshBootstrap={refreshBootstrap}
            session={session}
            refreshSession={refreshSession}
          />
        }
      />
      <Route
        path="*"
        element={
          <PublicSite
            bootstrap={bootstrap}
            refreshBootstrap={refreshBootstrap}
          />
        }
      />
    </Routes>
  );
}
