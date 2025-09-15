import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import ImageWithFallback from "./ImageWithFallback";

export default function IssueCarousel({ issues = [] }) {
  if (!issues.length) {
    return <div>No issues available.</div>;
  }

  return (
    <div className="w-full p-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {issues.map((issue) => (
          <Link key={issue.id} to={`/read/${issue.id}`} className="block">
            <div
              className="rounded border bg-[var(--background)] overflow-hidden cursor-pointer"
              style={{ borderColor: "var(--border)" }}
            >
              <motion.div
                layoutId={`issue-image-${issue.id}`}
                className="w-full aspect-square"
              >
                <ImageWithFallback
                  src={issue.thumbnail}
                  alt={issue.title}
                  className="w-full h-full object-cover"
                />
              </motion.div>
              <div className="p-2 text-center">
                <p className="text-sm font-medium text-[var(--foreground)]">
                  {issue.title}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

