import { useEffect, useState } from 'react';
import { fetchHomePanels } from '../api/supabase';

export default function useSupabaseHomePanels() {
  const [panels, setPanels] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await fetchHomePanels();
        const map = {};
        rows.forEach((row) => {
          if (typeof row?.id === 'number') {
            map[row.id] = {
              image:
                typeof row.image_url === 'string' ? row.image_url : undefined,
            };
          }
        });
        setPanels(map);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return { panels, loading, error };
}
