import { motion } from "framer-motion";

export default function IssueInfoPanel({ issue }) {
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
      {issue.cover && (
        <img
          src={issue.cover}
          alt={issue.title}
          className="w-full max-w-sm rounded"
        />
      )}
      <div className="text-center">
        <h2 className="text-2xl font-bold">
          {issue.title}
        </h2>
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
      {issue.link && (
        <a
          href={issue.link}
          className="px-4 py-2 mt-2 text-sm font-semibold text-white bg-blue-600 rounded hover:bg-blue-700"
        >
          Read this issue
        </a>
      )}
    </motion.div>
  );
}
