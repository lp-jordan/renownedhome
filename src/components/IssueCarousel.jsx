import { useEffect, useState } from "react";
import { fetchMediaById } from "../api/wordpress";
import ImageWithFallback from "./ImageWithFallback";

export default function IssueCarousel({
  issues: issuePosts,
  loading,
  error,
  selectedId,
  onSelect,
}) {
  const [coverImages, setCoverImages] = useState({});
  const [coverLoading, setCoverLoading] = useState(true);
  const [coverErrors, setCoverErrors] = useState({});

  if (loading || coverLoading) {
    return (
      <div className="w-full overflow-x-auto touch-pan-x">
        <div className="flex space-x-4 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex-shrink-0 rounded border bg-[var(--background)] overflow-hidden min-w-[150px] sm:min-w-[200px]"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="w-full h-40 bg-[var(--muted)] animate-pulse" />
              <div className="p-2 text-center">
                <div className="h-4 bg-[var(--muted)] rounded w-3/4 mx-auto animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || Object.values(coverErrors).some(Boolean)) {
    return <div>Error loading media.</div>;
  }

  const isNumeric = (value) =>
    typeof value === "number" || (typeof value === "string" && /^\d+$/.test(value));
  useEffect(() => {
    let active = true;
    const fetchWithTimeout = (promise, ms = 10000) =>
      Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
      ]);

    const load = async () => {
      if (!issuePosts.length) {
        setCoverImages({});
        setCoverErrors({});
        setCoverLoading(false);
        return;
      }

      setCoverLoading(true);
      setCoverErrors({});

      await Promise.allSettled(
        issuePosts.map(async (issue) => {
          const rawCoverField = issue.cover_image;
          let value;
          if (Array.isArray(rawCoverField)) {
            const first = rawCoverField[0];
            value = first?.url || first;
          } else {
            value = rawCoverField?.url || rawCoverField;
          }
          if (isNumeric(value)) {
            try {
              const mediaItem = await fetchWithTimeout(fetchMediaById(value));
              if (active) {
                setCoverImages((prev) => ({
                  ...prev,
                  [issue.id]: mediaItem?.source_url || "",
                }));
              }
            } catch {
              if (active) {
                setCoverImages((prev) => ({ ...prev, [issue.id]: "" }));
                setCoverErrors((prev) => ({ ...prev, [issue.id]: true }));
              }
            }
            return;
          }
          if (active) {
            setCoverImages((prev) => ({
              ...prev,
              [issue.id]: value || "",
            }));
          }
        })
      );

      if (active) {
        setCoverLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [issuePosts]);

  const issues = issuePosts.map((issue) => ({
    id: issue.id,
    title: issue.title,
    coverImage: coverImages[issue.id],
    releaseDate: issue.release_date,
    shortDescription: issue.short_description,
    longDescription: issue.long_description,
  }));

  const placeholders = Array.from({ length: 3 }, (_, i) => ({
    id: `placeholder-${i}`,
    placeholder: true,
  }));

  const displayIssues =
    loading && issuePosts.length === 0 ? placeholders : issues;

  return (
    <div className="w-full overflow-x-auto touch-pan-x">
      <div className="flex space-x-4 p-4">
        {displayIssues.map((issue) => {
          const imageSrc = issue.placeholder ? undefined : coverImages[issue.id];
          const imageError = coverErrors[issue.id];
          const isLoaded = imageSrc !== undefined;
          const handleClick = issue.placeholder
            ? undefined
            : () => onSelect?.(issue.id);
          return (
            <div
              key={issue.id}
              onClick={handleClick}
              className={`flex-shrink-0 rounded border bg-[var(--background)] overflow-hidden min-w-[150px] sm:min-w-[200px] transition-transform ${
                issue.placeholder
                  ? ""
                  : `cursor-pointer hover:scale-105 ${
                      selectedId === issue.id ? "ring-2 ring-[var(--accent)]" : ""
                    }`
              }`}
              style={{ borderColor: "var(--border)" }}
            >
              {isLoaded ? (
                <ImageWithFallback
                  src={imageSrc}
                  alt={issue.title}
                  className="w-full h-40 object-cover"
                />
              ) : (
                <div className="w-full h-40 bg-gray-200 animate-pulse" />
              )}
              <div className="p-2 text-center">
                <p className="text-sm font-medium text-[var(--foreground)]">
                  {issue.title ||
                    (issue.placeholder ? (
                      <span className="inline-block h-4 w-20 rounded bg-gray-200 animate-pulse" />
                    ) : (
                      ""
                    ))}
                </p>
              </div>
              {imageError && (
                <div className="p-1 text-center text-xs text-red-500">
                  Image unavailable
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
