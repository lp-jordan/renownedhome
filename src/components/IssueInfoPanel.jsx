import { motion } from "framer-motion";
import issues from "../data/issues";
import ImageWithFallback from "./ImageWithFallback";

export default function IssueInfoPanel({ issueId }) {
  const issue = issues.find((i) => i.id === issueId);

  if (!issue) {
    return null;
  }

  return (
    <motion.div
      key={issue.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="flex flex-col items-center gap-4 p-4 mt-4 border rounded bg-[var(--background)]"
      style={{ borderColor: "var(--border)" }}
    >
      {issue.coverImage && (
        <ImageWithFallback
          src={issue.coverImage}
          alt={issue.title}
          className="w-full max-w-sm rounded"
        />
      )}
      <div className="text-center">
        <h2 className="text-2xl font-bold">{issue.title}</h2>
        {issue.subtitle && (
          <h3 className="text-lg text-gray-500">{issue.subtitle}</h3>
        )}
      </div>
      {issue.description && (
        <p className="max-w-xl text-center">{issue.description}</p>
      )}
      {issue.credits && (
        <p className="text-sm text-gray-500 text-center">{issue.credits}</p>
      )}
    </motion.div>
  );
}
