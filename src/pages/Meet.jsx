import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PanelContent from "../components/PanelContent";
import TeamCarousel from "../components/TeamCarousel";
import TeamInfoPanel from "../components/TeamInfoPanel";
import ImageWithFallback from "../components/ImageWithFallback";

export default function Meet() {
  const [selectedMemberId, setSelectedMemberId] = useState(null);

  const handleSelect = (id) => {
    setSelectedMemberId((prev) => (prev === id ? null : id));
  };

  return (
    <PanelContent className="items-start justify-start">
      {/* Hero Section */}
      <motion.section
        className="relative flex-shrink-0 hero-half"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <ImageWithFallback
          src="/meet/hero.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
        <div className="relative flex flex-col items-center justify-center w-full h-full p-4 text-white text-center">
          <div className="flex flex-col md:flex-row items-center justify-center w-full gap-4 md:gap-8">
            <motion.h1
              layoutId="MEET"
              className="px-6 py-4 font-bold uppercase text-[clamp(3rem,8vw,10rem)]"
            >
              MEET
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-lg md:text-2xl max-w-xl text-center"
            >
              Learn about the team behind Renowned Home.
            </motion.p>
          </div>
        </div>
      </motion.section>

      {/* Carousel + Info Section */}
      <motion.div
        className="flex flex-col items-center justify-center w-full px-4 py-12 space-y-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <TeamCarousel selectedId={selectedMemberId} onSelect={handleSelect} />
        <AnimatePresence mode="wait">
          {selectedMemberId && (
            <TeamInfoPanel memberId={selectedMemberId} key={selectedMemberId} />
          )}
        </AnimatePresence>
      </motion.div>
    </PanelContent>
  );
}
