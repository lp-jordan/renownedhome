import { useEffect, useState } from "react";
import { fetchIssues } from "../api/supabase";

export default function useSupabaseIssues() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchIssues();
      // Normalize issue shape
      const mapped = data.map((item) => ({
        id: item.id,
        title: item.title,
        number: item.number,
        cover_image: item.cover_image,
        release_date: item.release_date,
        short_description: item.short_description,
        long_description: item.long_description,
        subtitle: item.subtitle,
        writer: item.writer,
        artist: item.artist,
        colorist: item.colorist,
      }));

      setIssues(mapped);
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