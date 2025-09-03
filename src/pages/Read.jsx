import { useState } from "react";
import { motion } from "framer-motion";
import Panel from "../components/Panel";
import ImageWithFallback from "../components/ImageWithFallback";
import IssueCarousel from "../components/IssueCarousel";
import content from "../../content/read.json";

export default function Read() {
  const {
    panel,
    hero: { heading, subtitle, image },
    issues = [],
  } = content;
  const [selectedId, setSelectedId] = useState(null);

  return (
    <Panel id={panel.main.id}>
      <div className="flex flex-col items-center">
        <motion.h1 layoutId={heading.layoutId} className={heading.className}>
          {heading.text}
        </motion.h1>
        {subtitle?.text && (
          <p className={subtitle.className}>{subtitle.text}</p>
        )}
        {image && (
          <ImageWithFallback
            src={image}
            alt={heading.text}
            className="mt-4 max-w-full"
          />
        )}
      </div>
      {issues.length > 0 && (
        <IssueCarousel
          issues={issues}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      )}
    </Panel>
  );
}
