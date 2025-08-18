import { useEffect, useState } from 'react';
import { fetchMedia, uploadMedia } from '../api/wordpress';

export default function useWordPressMedia() {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMedia();
      setMedia(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return { media, loading, error, refresh: load, uploadMedia };
}

