import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import ImageWithFallback from "./ImageWithFallback";

export default function IssueCarousel({ issues = [] }) {
  if (!issues.length) {
    return <div>No issues available.</div>;
  }

  return (
    <div className="w-full overflow-x-auto touch-pan-x">
      <div className="flex space-x-4 p-4">
        {issues.map((issue) => (
          <Link key={issue.order} to={`/read/${issue.order}`} className="block">
            <motion.div
              layoutId={`panel-issue-${issue.order}`}
              className="flex-shrink-0 rounded border bg-[var(--background)] overflow-hidden w-[150px] sm:w-[200px] cursor-pointer"
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
            </motion.div>
          </Link>
        ))}
      </div>
    </div>
  );
}

