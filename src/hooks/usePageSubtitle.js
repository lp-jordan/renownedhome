import { useEffect, useState } from "react";
import { fetchPageSubtitle } from "../api/supabase";

export default function usePageSubtitle(id) {
  const [headline, setHeadline] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchPageSubtitle(id);
        if (isMounted) {
          setHeadline(data?.headline_content ?? "");
        }
      } catch (err) {
        if (isMounted) {
          setError(err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [id]);

  return { headline, loading, error };
}
