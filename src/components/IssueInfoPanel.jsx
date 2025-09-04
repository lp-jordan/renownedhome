import { motion } from "framer-motion";

export default function IssueInfoPanel({ issue }) {
  if (!issue) {
    return null;
  }

  const title = issue.title?.rendered || issue.title;

  return (
    <motion.div
      key={issue.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="flex flex-col items-center gap-4 p-4 mt-4 border rounded bg-[var(--background)]"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">{title}</h2>
        {issue.subtitle && (
          <h3 className="text-lg text-gray-500">{issue.subtitle}</h3>
        )}
      </div>
      {issue.long_description && (
        <p className="max-w-xl text-center">{issue.long_description}</p>
      )}
      {(issue.writer || issue.artist || issue.colorist) && (
        <div className="text-sm text-gray-500 text-center">
          {issue.writer && <p>Writer: {issue.writer}</p>}
          {issue.artist && <p>Artist: {issue.artist}</p>}
          {issue.colorist && <p>Colorist: {issue.colorist}</p>}
        </div>
      )}
    </motion.div>
  );
}
