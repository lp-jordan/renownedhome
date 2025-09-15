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
    <Panel id={panel.main.name} centerChildren={false}>
      <div className="flex flex-col items-center w-full">
        <motion.h1
          layoutId={`panel-label-${panel.main.name}`}
          transition={{ duration: 0.4 }}
          className={`inline-block ${heading.className} ${heading.size} text-center`}
        >
          {heading.text}
        </motion.h1>
        {subtitle?.text && (
          <p className={`${subtitle.className} ${subtitle.size}`}>
            {subtitle.text}
          </p>
        )}
        {issues.length > 0 && <IssueCarousel issues={issues} />}
      </div>
    </Panel>
  );
}
