import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import content from "../../content/splash.json";

let hasShownSplash = false;

export default function SplashScreen({ children }) {
  const { logoSrc, subtitle } = content;
  const [dismissed, setDismissed] = useState(() => hasShownSplash);

  useEffect(() => {
    if (dismissed) {
      hasShownSplash = true;
      return;
    }
    const handleDismiss = () => setDismissed(true);
    window.addEventListener("wheel", handleDismiss, { once: true });
    window.addEventListener("touchmove", handleDismiss, { once: true });
    return () => {
      window.removeEventListener("wheel", handleDismiss);
      window.removeEventListener("touchmove", handleDismiss);
    };
  }, [dismissed]);

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
      <AnimatePresence>
        {!dismissed && (
          <motion.div
            key="splash"
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#fdfaf5]"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.img
              src={logoSrc}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.5 }}
              className="mb-4 h-24 w-24"
            />
            <motion.p
              className="text-center"
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
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </div>
  );
}
