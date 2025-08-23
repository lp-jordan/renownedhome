import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import useWordPressMedia from "../hooks/useWordPressMedia";
import ImageWithFallback from "./ImageWithFallback";
import { fetchMediaById } from "../api/wordpress";

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

  const [coverImage, setCoverImage] = useState("");

  useEffect(() => {
    let active = true;
    const resolveCover = async () => {
      let raw = Array.isArray(cover_image) ? cover_image[0] : cover_image;
      raw = raw?.url || raw;
      if (isNumeric(raw)) {
        try {
          const mediaItem = await fetchMediaById(raw);
          if (active) {
            setCoverImage(mediaItem?.source_url || "");
          }
        } catch {
          if (active) setCoverImage("");
        }
      } else {
        setCoverImage(raw || "");
      }
    };
    resolveCover();
    return () => {
      active = false;
    };
  }, [cover_image]);

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
