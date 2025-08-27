import { motion } from "framer-motion";
import ImageWithFallback from "./ImageWithFallback";
import { useMemo } from "react";

export default function IssueInfoPanel({ issue }) {
  if (!issue) {
    return null;
  }

  const title = issue.title?.rendered || issue.title;

  const normalizedCoverImage = useMemo(() => {
    let raw = issue.cover_image;

    // If it's an array, take the first entry
    if (Array.isArray(raw)) {
      raw = raw[0];
    }

    // If it's an object with .url
    if (typeof raw === "object" && raw?.url) {
      return raw.url;
    }

    // If it's a plain string (URL or empty)
    if (typeof raw === "string") {
      return raw;
    }

    return "";
  }, [issue.cover_image]);

  return (
    <motion.div
      key={issue.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="flex flex-col items-center gap-4 p-4 mt-4 border rounded bg-[var(--background)]"
      style={{ borderColor: "var(--border)" }}
    >
      {normalizedCoverImage && (
        <ImageWithFallback
          src={normalizedCoverImage}
          alt={title}
          className="w-full rounded"
        />
      )}
      <div className="text-center">
        <h2 className="text-2xl font-bold">{title}</h2>
        {issue.subtitle && (
          <h3 className="text-lg text-gray-500">{issue.subtitle}</h3>
        )}
      </div>
      {issue.long_description && (
        <p className="max-w-xl text-center">{issue.long_description}</p>
      )}
      {issue.credits && (
        <p className="text-sm text-gray-500 text-center">{issue.credits}</p>
      )}
    </motion.div>
  );
}