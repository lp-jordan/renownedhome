import { motion } from "framer-motion";
import Panel from "../components/Panel";
import ImageWithFallback from "../components/ImageWithFallback";
import content from "../../content/meet.json";

export default function Meet() {
  const {
    panel,
    hero: { heading, subtitle, image },
  } = content;

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
    </Panel>
  );
}
