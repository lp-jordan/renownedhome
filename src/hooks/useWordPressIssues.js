import { useEffect, useState } from 'react';
import { fetchIssues, fetchMediaItem } from '../api/wordpress';

export default function useWordPressIssues() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchIssues();

      const mediaIds = new Set();
      for (const issue of data) {
        const covers = issue.acf?.cover_image;
        const items = Array.isArray(covers) ? covers : [covers];
        for (const item of items) {
          if (
            typeof item === 'number' ||
            (typeof item === 'string' && /^\d+$/.test(item))
          ) {
            mediaIds.add(item);
          }
        }
      }

      const mediaMap = {};
      await Promise.all(
        [...mediaIds].map(async (id) => {
          try {
            const media = await fetchMediaItem(id);
            if (media?.source_url) {
              mediaMap[id] = media.source_url;
            }
          } catch (e) {
            // Ignore individual fetch errors
          }
        })
      );

      for (const issue of data) {
        const covers = issue.acf?.cover_image;
        if (Array.isArray(covers)) {
          issue.acf.cover_image = covers.map((item) => {
            if (typeof item === 'object' && item?.url) {
              return item.url;
            }
            if (typeof item === 'string' && /^https?:\/\//.test(item)) {
              return item;
            }
            if (
              typeof item === 'number' ||
              (typeof item === 'string' && /^\d+$/.test(item))
            ) {
              return mediaMap[item] || item;
            }
            return item;
          });
        } else if (covers) {
          if (typeof covers === 'object' && covers?.url) {
            issue.acf.cover_image = covers.url;
          } else if (
            typeof covers === 'number' ||
            (typeof covers === 'string' && /^\d+$/.test(covers))
          ) {
            issue.acf.cover_image = mediaMap[covers] || covers;
          }
        }
      }

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

