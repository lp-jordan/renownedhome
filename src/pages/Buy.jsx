import { motion } from "framer-motion";
import Panel from "../components/Panel";
import content from "../../content/buy.json";

export default function Buy() {
  const {
    panel,
    hero: { heading, subtitle, button },
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
        {button && (
          <a
            href={button.url}
            className="mt-4 group relative inline-flex items-center justify-center rounded bg-black px-6 py-3 text-white overflow-hidden"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="transition-opacity duration-300 group-hover:opacity-0">
              {button.defaultText}
            </span>
            <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              {button.hoverText}
            </span>
          </a>
        )}
      </div>
    </Panel>
  );
}
