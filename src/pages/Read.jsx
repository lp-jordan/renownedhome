import { motion } from "framer-motion";
import Panel from "../components/Panel";
import IssueCarousel from "../components/IssueCarousel";
import content from "../../content/read.json";

export default function Read() {
  const {
    panel,
    hero: { heading, subtitle },
    issues = [],
  } = content;

  return (
    <Panel id={panel.main.id} centerChildren={false}>
      <div className="flex flex-col items-center">
        <motion.h1
          layoutId={heading.layoutId}
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
      {issues.length > 0 && <IssueCarousel issues={issues} />}
    </Panel>
  );
}
