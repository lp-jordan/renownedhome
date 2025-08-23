import { useEffect, useState } from 'react';
import { fetchIssues } from '../api/wordpress';

export default function useWordPressIssues() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchIssues();
      const sorted = [...data].sort((a, b) => {
        const aNum = Number(a.acf?.number);
        const bNum = Number(b.acf?.number);
        const aVal = Number.isFinite(aNum) ? aNum : Infinity;
        const bVal = Number.isFinite(bNum) ? bNum : Infinity;
        return aVal - bVal;
      });
      setIssues(sorted);
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

