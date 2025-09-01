import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import ImageWithFallback from "./ImageWithFallback";

export default function PanelCard({
  className = "",
  imageSrc,
  label,
  to,
}) {
  const content = (
    <motion.div
      layoutId={`panel-${label}`}
      whileHover={{ scale: 1.02 }}
      className={`relative w-full h-full cursor-pointer border border-black rounded-lg overflow-hidden group bg-transparent ${className}`}
    >
      {imageSrc && (
        <ImageWithFallback
          src={imageSrc}
          alt={label}
          className="absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-[0.35] group-hover:grayscale"
        />
      )}
      {label && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <motion.span
            layoutId={label}
            className="text-black font-bold uppercase text-center text-[clamp(2rem,5vw,6rem)]"
          >
            {label}
          </motion.span>
        </div>
      )}
    </motion.div>
  );

  return to ? (
    <Link to={to} className="block h-full">
      {content}
    </Link>
  ) : (
    content
  );
}
