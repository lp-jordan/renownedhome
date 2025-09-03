import { motion } from "framer-motion";
import Panel from "../components/Panel";
import ImageWithFallback from "../components/ImageWithFallback";
import content from "../../content/buy.json";

export default function Buy() {
  const {
    panel,
    hero: { heading, subtitle, image, button },
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
        {button && (
          <a
            href={button.url}
            className="mt-4 group relative inline-block bg-black text-white px-[clamp(1rem,5vw,3rem)] py-[clamp(0.5rem,2vw,1rem)] text-[clamp(1rem,3vw,2rem)] overflow-hidden [perspective:1000px]"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="block transition-transform duration-300 [transform-origin:top] group-hover:[transform:rotateX(90deg)]">
              {button.defaultText}
            </span>
            <span className="absolute inset-0 block transition-transform duration-300 [transform-origin:bottom] [transform:rotateX(-90deg)] group-hover:[transform:rotateX(0deg)]">
              {button.hoverText}
            </span>
          </a>
        )}
        {image && (
          <ImageWithFallback
            src={image}
            alt={heading.text}
            className="mt-4 w-full h-auto"
          />
        )}
      </div>
    </Panel>
  );
}
