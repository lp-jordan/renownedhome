import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useState } from "react";
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

  const [leaving, setLeaving] = useState(false);

  const variants = {
    hidden: { opacity: 0, x: -10 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -10 },
  };

  const handleClick = () => {
    setLeaving(true);
  };

  return (
    <motion.button
      type="button"
      className={className}
      style={{ borderColor: "var(--border)" }}
      onClick={handleClick}
      initial="hidden"
      animate={leaving ? "exit" : "visible"}
      variants={variants}
      transition={{ duration: 0.2 }}
      onAnimationComplete={() => {
        if (leaving) {
          navigate(-1);
        }
      }}
    >
      <ImageWithFallback
        src="/logo.png"
        alt="Logo"
        className="w-full h-full object-contain"
      />
    </motion.button>
  );
}
