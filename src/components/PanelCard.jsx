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
}) {
  const content = (
    <motion.div
      layoutId={`panel-${label}`}
      whileHover={{ scale: 1.02 }}
      initial={initial}
      animate={animate}
        transition={transition}
        className={`relative w-full h-full cursor-pointer border border-black rounded-lg overflow-hidden group bg-transparent flex items-center justify-center ${className}`}
    >
      {imageSrc && (
        <ImageWithFallback
          src={imageSrc}
          alt={label}
          className="absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-[0.35] group-hover:grayscale"
        />
      )}
      {label && (
        <motion.span
          layoutId={label}
          className="pointer-events-none text-black font-bold uppercase text-center text-[clamp(2rem,5vw,6rem)]"
        >
          {label}
        </motion.span>
      )}
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
