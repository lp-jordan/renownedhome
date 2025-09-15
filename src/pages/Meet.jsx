import { motion } from "framer-motion";
import Panel from "../components/Panel";
import content from "../../content/meet.json";

export default function Meet() {
  const {
    panel,
    hero: { heading, subtitle },
  } = content;

  return (
    <Panel id={panel.main.name}>
      <div className="flex flex-col items-center">
        <motion.h1
          layoutId={`panel-label-${panel.main.name}`}
          className={`${heading.className} ${heading.size} mb-2`}
        >
          {heading.text}
        </motion.h1>
        {subtitle?.text && (
          <p className={`${subtitle.className} ${subtitle.size}`}>
            {subtitle.text}
          </p>
        )}
      </div>
    </Panel>
  );
}
