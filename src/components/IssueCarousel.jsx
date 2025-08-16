import { useState } from "react";

export default function IssueCarousel() {
  const issues = Array.from({ length: 5 }, (_, i) => ({
    id: i + 1,
    title: `Issue ${i + 1}`,
    image: `https://picsum.photos/seed/issue${i + 1}/300/400`,
  }));

  const [selected, setSelected] = useState(null);

  return (
    <div className="w-full overflow-x-auto touch-pan-x">
      <div className="flex space-x-4 p-4">
        {issues.map((issue) => (
          <div
            key={issue.id}
            onClick={() => setSelected(issue.id)}
            className={`flex-shrink-0 cursor-pointer rounded border bg-[var(--background)] overflow-hidden min-w-[150px] sm:min-w-[200px] transition-transform hover:scale-105 ${
              selected === issue.id ? "ring-2 ring-[var(--accent)]" : ""
            }`}
            style={{ borderColor: "var(--border)" }}
          >
            <img
              src={issue.image}
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

