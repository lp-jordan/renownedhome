import { useMemo } from "react";
import ImageWithFallback from "./ImageWithFallback";

export default function IssueCarousel({
  issues: issuePosts,
  loading,
  error,
  selectedId,
  onSelect,
}) {
  if (loading) {
    return (
      <div className="w-full overflow-x-auto touch-pan-x">
        <div className="flex space-x-4 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex-shrink-0 rounded border bg-[var(--background)] overflow-hidden w-[150px] sm:w-[200px]"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="w-full aspect-square bg-[var(--muted)] animate-pulse" />
              <div className="p-2 text-center">
                <div className="h-4 bg-[var(--muted)] rounded w-3/4 mx-auto animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return <div>Error loading issues.</div>;
  }

  // Normalize cover images regardless of format
  const issues = useMemo(() => {
    return issuePosts.map((issue) => {
      let coverImage = issue.cover_image;

      if (Array.isArray(coverImage)) {
        const first = coverImage[0];
        coverImage = first?.url || first;
      } else if (typeof coverImage === "object" && coverImage?.url) {
        coverImage = coverImage.url;
      }

      return {
        id: issue.id,
        title: issue.title?.rendered || issue.title,
        coverImage,
        releaseDate: issue.release_date,
        shortDescription: issue.short_description,
        longDescription: issue.long_description,
      };
    });
  }, [issuePosts]);

  if (!issues.length) {
    return <div>No issues available.</div>;
  }

  return (
    <div className="w-full overflow-x-auto touch-pan-x">
      <div className="flex space-x-4 p-4">
        {issues.map((issue) => {
          const handleClick = () => onSelect?.(issue.id);
          return (
            <div
              key={issue.id}
              onClick={handleClick}
              className={`flex-shrink-0 rounded border bg-[var(--background)] overflow-hidden w-[150px] sm:w-[200px] transition-transform cursor-pointer hover:scale-105 ${
                selectedId === issue.id ? "ring-2 ring-[var(--accent)]" : ""
              }`}
              style={{ borderColor: "var(--border)" }}
            >
              <div className="w-full aspect-square">
                {issue.coverImage ? (
                  <ImageWithFallback
                    src={issue.coverImage}
                    alt={issue.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200 animate-pulse" />
                )}
              </div>
              <div className="p-2 text-center">
                <p className="text-sm font-medium text-[var(--foreground)]">
                  {issue.title || (
                    <span className="inline-block h-4 w-20 rounded bg-gray-200 animate-pulse" />
                  )}
                </p>
              </div>
              {!issue.coverImage && (
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