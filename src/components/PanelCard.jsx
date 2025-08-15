import { Link } from "react-router-dom";
import { motion } from "framer-motion";

export default function PanelCard({
  className = "",
  imageSrc,
  label,
  to,
}) {
  const content = (
    <div
      className={`relative w-full h-full overflow-hidden cursor-pointer group ${className}`}
    >
      {imageSrc && (
        <img
          src={imageSrc}
          alt={label}
          className="object-cover w-full h-full"
        />
      )}
      <div className="absolute inset-0 bg-black opacity-0 transition-opacity duration-300 group-hover:opacity-20 pointer-events-none" />
      {label && (
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            layoutId={label}
            className="text-black font-bold uppercase text-center"
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
