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
    <div
      className={`relative w-full h-full overflow-hidden cursor-pointer group border bg-[var(--background)] ${className}`}
      style={{ borderColor: "var(--border)" }}
    >
      {imageSrc && (
        <ImageWithFallback
          src={imageSrc}
          alt={label}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      <div className="absolute inset-0 bg-black opacity-0 transition-opacity duration-300 group-hover:opacity-20 pointer-events-none" />
      {label && (
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            layoutId={label}
            className="relative z-50 text-white font-bold uppercase text-center text-[clamp(2rem,5vw,6rem)]"
          >
            {label}
          </motion.span>
        </div>
      )}
    </div>
  );

  return to ? (
    <Link to={to} className="block h-full">
      {content}
    </Link>
  ) : (
    content
  );
}
