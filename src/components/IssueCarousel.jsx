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

  if (error) {
    return <div>Error loading media.</div>;
  }

  const issues = issuePosts.map((issue) => ({
    id: issue.id,
    title: issue.title?.rendered || issue.title,
    coverImage: issue.cover_image,
    releaseDate: issue.release_date,
    shortDescription: issue.short_description,
    longDescription: issue.long_description,
  }));

  return (
    <div className="w-full overflow-x-auto touch-pan-x">
      <div className="flex space-x-4 p-4">
        {issues.map((issue) => {
          const imageSrc = issue.coverImage;
          const handleClick = () => onSelect?.(issue.id);
          return (
            <div
              key={issue.id}
              onClick={handleClick}
              className={`flex-shrink-0 rounded border bg-[var(--background)] overflow-hidden min-w-[150px] sm:min-w-[200px] transition-transform cursor-pointer hover:scale-105 ${
                selectedId === issue.id ? "ring-2 ring-[var(--accent)]" : ""
              }`}
              style={{ borderColor: "var(--border)" }}
            >
              {imageSrc ? (
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
                  {issue.title || (
                    <span className="inline-block h-4 w-20 rounded bg-gray-200 animate-pulse" />
                  )}
                </p>
              </div>
              {!imageSrc && (
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
