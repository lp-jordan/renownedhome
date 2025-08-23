import { useEffect, useState } from "react";
import useWordPressIssues from "../hooks/useWordPressIssues";
import { fetchMediaById } from "../api/wordpress";
import ImageWithFallback from "./ImageWithFallback";

export default function IssueCarousel({ selectedId, onSelect }) {
  const { issues: issuePosts, loading, error } = useWordPressIssues();
  const [coverImages, setCoverImages] = useState({});
  const [coverLoading, setCoverLoading] = useState(true);
  const [coverError, setCoverError] = useState(null);

  if (loading || coverLoading) {
    return <div>Loading...</div>;
  }

  if (error || coverError) {
    return <div>Error loading media.</div>;
  }

  const isNumeric = (value) =>
    typeof value === "number" || (typeof value === "string" && /^\d+$/.test(value));
  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!issuePosts.length) {
        setCoverImages({});
        setCoverLoading(false);
        return;
      }
      setCoverLoading(true);
      setCoverError(null);
      try {
        const entries = await Promise.all(
          issuePosts.map(async (issue) => {
            const rawCoverField = issue.acf?.cover_image;
            let value;
            if (Array.isArray(rawCoverField)) {
              const first = rawCoverField[0];
              value = first?.url || first;
            } else {
              value = rawCoverField?.url || rawCoverField;
            }
            if (isNumeric(value)) {
              try {
                const mediaItem = await fetchMediaById(value);
                return [issue.id, mediaItem?.source_url || ""];
              } catch {
                return [issue.id, ""];
              }
            }
            return [
              issue.id,
              value || issue._embedded?.["wp:featuredmedia"]?.[0]?.source_url || "",
            ];
          })
        );
        if (active) {
          setCoverImages(Object.fromEntries(entries));
        }
      } catch (err) {
        if (active) {
          setCoverError(err);
        }
      } finally {
        if (active) {
          setCoverLoading(false);
        }
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [issuePosts]);

  const issues = issuePosts.map((issue) => ({
    id: issue.id,
    title: issue.title.rendered,
    coverImage: coverImages[issue.id] || "",
    releaseDate: issue.acf.release_date,
    shortDescription: issue.acf.short_description,
    longDescription: issue.acf.long_description,
  }));

  return (
    <div className="w-full overflow-x-auto touch-pan-x">
      <div className="flex space-x-4 p-4">
        {issues.map((issue) => (
          <div
            key={issue.id}
            onClick={() => onSelect?.(issue.id)}
            className={`flex-shrink-0 cursor-pointer rounded border bg-[var(--background)] overflow-hidden min-w-[150px] sm:min-w-[200px] transition-transform hover:scale-105 ${
              selectedId === issue.id ? "ring-2 ring-[var(--accent)]" : ""
            }`}
            style={{ borderColor: "var(--border)" }}
          >
            <ImageWithFallback
              src={issue.coverImage}
              alt={issue.title}
              className="w-full h-40 object-cover"
            />
            <div className="p-2 text-center">
              <p className="text-sm font-medium text-[var(--foreground)]">
                {issue.title}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
