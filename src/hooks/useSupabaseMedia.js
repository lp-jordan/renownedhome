import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const mediaBucket = import.meta.env.VITE_SUPABASE_MEDIA_BUCKET || "media";

if (import.meta.env.DEV) {
  console.log("Supabase URL:", supabaseUrl);
  console.log("Supabase anon key (first 6 chars):", supabaseKey?.slice(0, 6));
  console.log("Supabase media bucket:", mediaBucket);
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default function useSupabaseMedia() {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: listError } = await supabase.storage
        .from(mediaBucket)
        .list();
      if (listError) throw listError;

      const items = await Promise.all(
        (data || []).map(async (item) => {
          const { data: publicData } = supabase.storage
            .from(mediaBucket)
            .getPublicUrl(item.name);
          const url = publicData?.publicUrl || "";
          return {
            id: item.id || item.name,
            title: { rendered: item.name },
            media_details: { sizes: { medium: { source_url: url } } },
            source_url: url,
            caption: { rendered: "" },
          };
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
    const filePath = `${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from(mediaBucket)
      .upload(filePath, file);
    if (uploadError) throw uploadError;

    const { data: publicData } = supabase.storage
      .from(mediaBucket)
      .getPublicUrl(filePath);
    const url = publicData?.publicUrl || "";
    return { id: filePath, url };
  };

  useEffect(() => {
    load();
  }, []);

  return { media, loading, error, refresh: load, uploadMedia };
}

