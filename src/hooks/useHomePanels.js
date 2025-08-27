import { useEffect, useState } from 'react';
import { fetchHomePanels } from '../api/supabase';

export default function useHomePanels() {
  const [panels, setPanels] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchHomePanels();
        const map = {};
        data.forEach((item) => {
          if (item?.label) {
            map[item.label] = {
              image: typeof item.image === 'string' ? item.image : undefined,
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
