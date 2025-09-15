import { motion } from "framer-motion";
import Panel from "../components/Panel";
import content from "../../content/connect.json";

export default function Connect() {
  const {
    panel,
    hero: { heading, subtitle },
    icons = [],
  } = content;

  return (
    <Panel id={panel.main.name}>
      <div className="flex flex-col items-center">
        <motion.h1
          layoutId={`panel-label-${panel.main.name}`}
          transition={{ duration: 0.4 }}
          className={`${heading.className} ${heading.size} mb-2`}
        >
          {heading.text}
        </motion.h1>
        {subtitle?.text && (
          <p className={`${subtitle.className} ${subtitle.size}`}>
            {subtitle.text}
          </p>
        )}
        <div
          data-supascribe-embed-id="478951807419"
          data-supascribe-subscribe
          className="mt-4"
        />
        {icons.length > 0 && (
          <div className="flex gap-4 mt-8">
            {icons.map((icon) => (
              <a
                key={icon.id}
                href={icon.link || "#"}
                className="w-24 h-24 rounded-full overflow-hidden transition-transform duration-200 hover:scale-105"
              >
                <img
                  src={icon.image}
                  alt={`icon-${icon.id}`}
                  className="w-full h-full object-cover rounded-full"
                />
              </a>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}
