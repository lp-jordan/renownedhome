import ImageWithFallback from "./ImageWithFallback";

export default function IssueCarousel({ issues = [], selectedId, onSelect }) {
  if (!issues.length) {
    return <div>No issues available.</div>;
  }

  return (
    <div className="w-full overflow-x-auto touch-pan-x">
      <div className="flex space-x-4 p-4">
        {issues.map((issue) => {
          const isSelected = selectedId === issue.order;
          const handleClick = () => onSelect?.(isSelected ? null : issue.order);
          return (
            <div
              key={issue.order}
              onClick={handleClick}
              className={[
                "flex-shrink-0 rounded border bg-[var(--background)] overflow-hidden w-[150px] sm:w-[200px] cursor-pointer",
                isSelected ? "ring-2 ring-[var(--accent)]" : "",
              ].join(" ")}
              style={{ borderColor: "var(--border)" }}
            >
              <div className="w-full aspect-square">
                <ImageWithFallback
                  src={issue.thumbnail}
                  alt={issue.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-2 text-center">
                <p className="text-sm font-medium text-[var(--foreground)]">
                  {issue.title}
                </p>
              </div>
              {isSelected && (
                <div className="p-2 text-xs text-left space-y-1">
                  <p className="font-semibold">{issue.subtitle}</p>
                  <p>{issue.description}</p>
                  <p>Writer: {issue.writer}</p>
                  <p>Artist: {issue.artist}</p>
                  <p>Colorist: {issue.colorist}</p>
                  <p>Release: {issue.releaseDate}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
