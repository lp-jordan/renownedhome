import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

export default function SplashScreen({ children, onUnlock }) {
  const [hasScrolled, setHasScrolled] = useState(
    () => sessionStorage.getItem("homeVisited") === "true"
  );
  const [showSplash, setShowSplash] = useState(!hasScrolled);

  useEffect(() => {
    if (hasScrolled) return;

    const handleScroll = () => {
      sessionStorage.setItem("homeVisited", "true");
      setHasScrolled(true);
      onUnlock?.();
    };

    window.addEventListener("scroll", handleScroll, { once: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hasScrolled, onUnlock]);

  useEffect(() => {
    if (!hasScrolled) return;
    const timeout = setTimeout(() => setShowSplash(false), 500);
    return () => clearTimeout(timeout);
  }, [hasScrolled]);

  return (
    <div className={`relative h-full w-full ${showSplash ? "overflow-hidden" : ""}`}>
      <AnimatePresence>
        {showSplash && (
          <>
            <motion.img
              key="logo"
              src="/logo.svg"
              initial={{ opacity: 0, top: "50%", left: "50%", x: "-50%", y: "-50%" }}
              animate=
                {hasScrolled
                  ? {
                      opacity: 1,
                      top: "1rem",
                      right: "1rem",
                      left: "auto",
                      x: 0,
                      y: 0,
                      scale: 0.5,
                    }
                  : {
                      opacity: 1,
                      top: "50%",
                      left: "50%",
                      x: "-50%",
                      y: "-50%",
                      scale: 1,
                    }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className={`absolute ${hasScrolled ? "logo-top-right" : ""}`}
            />
            <motion.p
              key="text"
              className="absolute left-1/2 top-1/2 mt-16 -translate-x-1/2 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              Renowned Home
            </motion.p>
          </>
        )}
      </AnimatePresence>
      <motion.div
        className="relative h-full w-full"
        initial={{ opacity: showSplash ? 0 : 1 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {children}
      </motion.div>
    </div>
  );
}
