import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export default function SplashScreen({ children }) {
  const [hasScrolled, setHasScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setHasScrolled(true);
    };

    window.addEventListener("scroll", handleScroll, { once: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <motion.img
        src="/logo.svg"
        initial={{ opacity: 0, top: "50%", left: "50%", x: "-50%", y: "-50%" }}
        animate={
          hasScrolled
            ? { opacity: 1, top: "1rem", right: "1rem", left: "auto", x: 0, y: 0, scale: 0.5 }
            : { opacity: 1, top: "50%", left: "50%", x: "-50%", y: "-50%", scale: 1 }
        }
        transition={{ duration: 0.5 }}
        className={`absolute ${hasScrolled ? "logo-top-right" : ""}`}
      />
      <motion.p
        className="absolute left-1/2 top-1/2 mt-16 -translate-x-1/2 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: hasScrolled ? 0 : 1 }}
        transition={{ duration: 0.5 }}
      >
        Renowned Home
      </motion.p>
      <motion.div
        className="relative h-full w-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: hasScrolled ? 1 : 0 }}
        transition={{ duration: 0.5 }}
      >
        {children}
      </motion.div>
    </div>
  );
}
