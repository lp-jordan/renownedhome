import { useEffect, useState } from "react";

export default function useSupabaseIssues() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!url || !key) {
        throw new Error("Supabase credentials are not configured");
      }
      const res = await fetch(`${url}/rest/v1/issues?select=*`, {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
      });
      if (!res.ok) {
        throw new Error("Failed to fetch issues");
      }
      const data = await res.json();
      setIssues(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return { issues, loading, error, refresh: load };
}
