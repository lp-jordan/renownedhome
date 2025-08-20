import useWordPressIssues from "../hooks/useWordPressIssues";
import ImageWithFallback from "./ImageWithFallback";

export default function IssueCarousel({ selectedId, onSelect }) {
  const { issues: issuePosts, loading, error } = useWordPressIssues();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error loading media.</div>;
  }

  const issues = issuePosts.map((issue) => {
    const rawCover = issue.acf?.cover_image?.url || issue.acf?.cover_image;
    const coverImage =
      typeof rawCover === "number" ||
      (typeof rawCover === "string" && /^\d+$/.test(rawCover))
        ? issue._embedded?.["wp:featuredmedia"]?.[0]?.source_url
        : rawCover || issue._embedded?.["wp:featuredmedia"]?.[0]?.source_url;

    return {
      id: issue.id,
      title: issue.title.rendered,
      coverImage,
      releaseDate: issue.acf.release_date,
      shortDescription: issue.acf.short_description,
      longDescription: issue.acf.long_description,
    };
  });

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
