import { useEffect, useState } from "react";
import { supabase, fetchMediaList, uploadMedia as uploadMediaHelper } from "../api/supabase";

export default function useSupabaseMedia() {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMediaList();
      const items = await Promise.all(
        (data || []).map(async (item) => {
          if (!item?.source_url && item?.path) {
            const { data: publicData } = supabase.storage
              .from("media")
              .getPublicUrl(item.path);
            return { ...item, source_url: publicData?.publicUrl || "" };
          }
          return item;
        })
      );
      setMedia(items);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const uploadMedia = async (file) => {
    return uploadMediaHelper(file);
  };

  useEffect(() => {
    load();
  }, []);

  return { media, loading, error, refresh: load, uploadMedia };
}

