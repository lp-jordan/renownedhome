import { useEffect, useState } from 'react';
import { fetchIssues } from '../api/supabase';

export default function useSupabaseIssues() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchIssues();
      const sorted = [...data].sort((a, b) => {
        const aVal = Number(a.number);
        const bVal = Number(b.number);
        const aNum = Number.isFinite(aVal) ? aVal : Infinity;
        const bNum = Number.isFinite(bVal) ? bVal : Infinity;
        return aNum - bNum;
      });
      const mapped = sorted.map((item) => ({
        id: item.id,
        title: item.title,
        number: item.number,
        cover_image: item.cover_image,
        release_date: item.release_date,
        short_description: item.short_description,
        long_description: item.long_description,
        subtitle: item.subtitle,
        credits: item.credits,
      }));
      setIssues(mapped);
    } catch (err) {
      // Capture the error in state and let callers decide how to render it
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

