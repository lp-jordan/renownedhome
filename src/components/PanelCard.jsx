import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import ImageWithFallback from "./ImageWithFallback";

export default function PanelCard({
  className = "",
  imageSrc,
  label,
  to,
  initial,
  animate,
  transition,
  isTransforming = false,
  fadeDelay = 0,
}) {
  const content = (
    <motion.div
      whileHover={{ scale: 1.02 }}
      initial={initial}
      animate={animate}
      transition={transition}
      className={`relative w-full h-full cursor-pointer rounded-lg overflow-hidden group ${className}`}
    >
      {imageSrc && (
        <motion.div
          initial={isTransforming ? { opacity: 0 } : undefined}
          animate={isTransforming ? { opacity: 1 } : undefined}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, delay: isTransforming ? fadeDelay : 0 }}
          className="absolute inset-0 w-full h-full"
        >
          <ImageWithFallback
            src={imageSrc}
            alt={label}
            className="absolute inset-0 w-full h-full object-cover z-0 filter grayscale contrast-50 blur-sm transition duration-300 group-hover:grayscale-0 group-hover:contrast-100 group-hover:saturate-[0.75] group-hover:blur-0"
          />
        </motion.div>
      )}
      <motion.div
        layoutId={`panel-${label}`}
        transition={{ duration: 0.4 }}
        className="absolute inset-0 border border-black rounded-lg flex items-center justify-center pointer-events-none"
      >
        {label && (
          <motion.span
            layoutId={`panel-label-${label}`}
            transition={{ duration: 0.4 }}
            className="relative z-10 text-black group-hover:text-white transition-colors duration-300 font-hero font-bold uppercase text-center text-[clamp(2rem,5vw,6rem)]"
          >
            {label}
          </motion.span>
        )}
      </motion.div>
    </motion.div>
  );

  return to ? (
    <Link to={to} className="block w-full h-full">
      {content}
    </Link>
  ) : (
    content
  );
}
