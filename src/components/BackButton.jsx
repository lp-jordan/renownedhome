import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import ImageWithFallback from "./ImageWithFallback";

export default function BackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === "/";
  if (isHome) {
    return null;
  }
  const positionClasses = "mr-2";
  const baseClasses =
    "w-12 h-12 rounded-full border overflow-hidden transition-colors duration-200";
  const className = `${baseClasses} ${positionClasses}`;

  return (
    <motion.button
      layoutId="back-button"
      type="button"
      className={className}
      style={{ borderColor: "var(--border)" }}
      onClick={() => navigate(-1)}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
    >
      <ImageWithFallback
        src="/logo.png"
        alt="Logo"
        className="w-full h-full object-contain"
      />
    </motion.button>
  );
}
