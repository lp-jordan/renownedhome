import useWordPressMedia from "../hooks/useWordPressMedia";
import ImageWithFallback from "./ImageWithFallback";

export default function IssueCarousel({ selectedId, onSelect }) {
  const { media, loading, error } = useWordPressMedia();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error loading media.</div>;
  }

  const issues = media.map((m) => ({
    id: m.id,
    title: m.title?.rendered || "Untitled",
    previewImage: m.media_details?.sizes?.medium?.source_url || m.source_url,
    coverImage: m.source_url,
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
              src={issue.previewImage}
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
