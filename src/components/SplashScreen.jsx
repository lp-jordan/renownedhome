import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

export default function SplashScreen({
  children,
  onUnlock,
  logoSrc = "/logo.svg",
  subtitle = "Renowned Home",
}) {
  const [isAtTop, setIsAtTop] = useState(true);
  const unlockedRef = useRef(false);

  useEffect(() => {
    const handleScroll = () => {
      const atTop = window.scrollY === 0;
      setIsAtTop(atTop);
      if (!unlockedRef.current && !atTop) {
        unlockedRef.current = true;
        onUnlock?.();
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [onUnlock]);

  const words = subtitle.split(" ");
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: 0.5,
        staggerChildren: words.length ? 1.5 / words.length : 0,
      },
    },
    exit: { opacity: 0 },
  };
  const wordVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.5 } },
  };

  return (
    <div className="relative h-full w-full">
      <motion.img
        key="logo"
        src={logoSrc}
        initial={{ opacity: 0, top: "50%", left: "50%", x: "-50%", y: "-50%" }}
        animate=
          isAtTop{
            ? {
                opacity: 1,
                top: "50%",
                left: "50%",
                x: "-50%",
                y: "-50%",
                scale: 1,
              }
            : {
                opacity: 1,
                top: "1.5rem",
                right: "1.5rem",
                left: "auto",
                x: 0,
                y: 0,
                scale: 0.5,
              }
      }
        transition={{ duration: 0.5 }}
        className="absolute z-50 pointer-events-none"
      />
      <AnimatePresence>
        {isAtTop && (
          <motion.p
            key="text"
            className="absolute left-1/2 top-1/2 mt-16 -translate-x-1/2 text-center z-40"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {words.map((word, idx) => (
              <motion.span
                key={idx}
                variants={wordVariants}
                className="inline-block mr-2"
              >
                {word}
              </motion.span>
            ))}
          </motion.p>
        )}
      </AnimatePresence>
      <motion.div
        className="relative h-full w-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: isAtTop ? 0 : 1 }}
        transition={{ duration: 0.5 }}
      >
        {children}
      </motion.div>
    </div>
  );
}
