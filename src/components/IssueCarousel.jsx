import useWordPressIssues from "../hooks/useWordPressIssues";
import useWordPressMedia from "../hooks/useWordPressMedia";
import ImageWithFallback from "./ImageWithFallback";

export default function IssueCarousel({ selectedId, onSelect }) {
  const { issues: issuePosts, loading, error } = useWordPressIssues();
  const {
    media,
    loading: mediaLoading,
    error: mediaError,
  } = useWordPressMedia();

  if (loading || mediaLoading) {
    return <div>Loading...</div>;
  }

  if (error || mediaError) {
    return <div>Error loading media.</div>;
  }

  const isNumeric = (value) =>
    typeof value === "number" || (typeof value === "string" && /^\d+$/.test(value));

  const issues = issuePosts.map((issue) => {
    const rawCoverField = issue.acf?.cover_image;
    let coverImageCandidate;
    if (Array.isArray(rawCoverField)) {
      const first = rawCoverField[0];
      if (isNumeric(first)) {
        const mediaItem = media.find((item) => item.id === Number(first));
        coverImageCandidate = mediaItem?.source_url;
      } else {
        coverImageCandidate = first?.url || first;
      }
    } else {
      const rawCover = rawCoverField?.url || rawCoverField;
      if (isNumeric(rawCover)) {
        const mediaItem = media.find((item) => item.id === Number(rawCover));
        coverImageCandidate =
          mediaItem?.source_url || issue._embedded?.["wp:featuredmedia"]?.[0]?.source_url;
      } else {
        coverImageCandidate =
          rawCover || issue._embedded?.["wp:featuredmedia"]?.[0]?.source_url;
      }
    }
    const coverImage =
      typeof coverImageCandidate === "string" ? coverImageCandidate : "";

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
