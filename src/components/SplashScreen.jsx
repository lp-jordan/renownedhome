import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export default function SplashScreen({ children }) {
  const [hasScrolled, setHasScrolled] = useState(
    () => sessionStorage.getItem("homeVisited") === "true"
  );

  useEffect(() => {
    if (hasScrolled) return;

    const handleScroll = () => {
      sessionStorage.setItem("homeVisited", "true");
      setHasScrolled(true);
      onUnlock?.();
    };

    window.addEventListener("scroll", handleScroll, { once: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hasScrolled]);

  return (
    <div
      className={`relative h-full w-full ${hasScrolled ? "" : "overflow-hidden"}`}
    >
      <motion.img
        src="/logo.svg"
        initial=
          {hasScrolled
            ? { opacity: 1, top: "1rem", right: "1rem", left: "auto", x: 0, y: 0, scale: 0.5 }
            : { opacity: 0, top: "50%", left: "50%", x: "-50%", y: "-50%" }}
        animate=
          {hasScrolled
            ? { opacity: 1, top: "1rem", right: "1rem", left: "auto", x: 0, y: 0, scale: 0.5 }
            : { opacity: 1, top: "50%", left: "50%", x: "-50%", y: "-50%", scale: 1 }}
        transition={{ duration: 0.5 }}
        className={`absolute ${hasScrolled ? "logo-top-right" : ""}`}
      />
      {!hasScrolled && (
        <motion.p
          className="absolute left-1/2 top-1/2 mt-16 -translate-x-1/2 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          Renowned Home
        </motion.p>
      )}
      <motion.div
        className="relative h-full w-full"
        initial={{ opacity: hasScrolled ? 1 : 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {children}
      </motion.div>
    </div>
  );
}
