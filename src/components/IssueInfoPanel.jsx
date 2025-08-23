import { motion } from "framer-motion";
import ImageWithFallback from "./ImageWithFallback";
import useWordPressMedia from "../hooks/useWordPressMedia";

export default function IssueInfoPanel({ issue }) {
  if (!issue) {
    return null;
  }

  const { media } = useWordPressMedia();

  const title = issue.title?.rendered || issue.title;
  const {
    cover_image,
    subtitle,
    long_description: description,
    credits,
  } = issue.acf || {};

  const isNumeric = (value) =>
    typeof value === "number" || (typeof value === "string" && /^\d+$/.test(value));

  let coverImage = Array.isArray(cover_image)
    ? cover_image[0]?.url || cover_image[0]
    : cover_image?.url || cover_image;

  if (Array.isArray(cover_image)) {
    const first = cover_image[0];
    if (isNumeric(first)) {
      const mediaItem = media.find((item) => item.id === Number(first));
      coverImage = mediaItem?.source_url || "";
    }
  } else if (isNumeric(coverImage)) {
    const mediaItem = media.find((item) => item.id === Number(coverImage));
    coverImage = mediaItem?.source_url || "";
  }

  const hasCoverImage = Boolean(coverImage);

  return (
    <motion.div
      key={issue.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="flex flex-col items-center gap-4 p-4 mt-4 border rounded bg-[var(--background)]"
      style={{ borderColor: "var(--border)" }}
    >
      {hasCoverImage && (
        <ImageWithFallback
          src={coverImage}
          alt={title}
          className="w-full rounded"
        />
      )}
      <div className="text-center">
        <h2 className="text-2xl font-bold">{title}</h2>
        {subtitle && (
          <h3 className="text-lg text-gray-500">{subtitle}</h3>
        )}
      </div>
      {description && (
        <p className="max-w-xl text-center">{description}</p>
      )}
      {credits && (
        <p className="text-sm text-gray-500 text-center">{credits}</p>
      )}
    </motion.div>
  );
}
