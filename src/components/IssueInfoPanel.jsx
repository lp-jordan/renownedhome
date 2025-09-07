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
      className="flex flex-col gap-4 mt-6 w-full"
    >
      <div className="text-center">
        <h1 className="text-3xl font-bold">{title}</h1>
        {(issue.writer || issue.artist || issue.colorist) && (
          <div className="mt-2 text-sm text-gray-500">
            {issue.writer && <p>Writer: {issue.writer}</p>}
            {issue.artist && <p>Artist: {issue.artist}</p>}
            {issue.colorist && <p>Colorist: {issue.colorist}</p>}
          </div>
        )}
      </div>
      {issue.subtitle && (
        <h2 className="text-gray-500 text-left">{issue.subtitle}</h2>
      )}
      {issue.description && (
        <p className="text-left text-black">{issue.description}</p>
      )}
    </motion.div>
  );
}
