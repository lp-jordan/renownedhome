import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PanelContent from "../components/PanelContent";
import TeamCarousel from "../components/TeamCarousel";
import TeamInfoPanel from "../components/TeamInfoPanel";
import BackButton from "../components/BackButton";
import usePageSubtitle from "../hooks/usePageSubtitle";

export default function Meet() {
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const { headline } = usePageSubtitle(3);

  const handleSelect = (id) => {
    setSelectedMemberId((prev) => (prev === id ? null : id));
  };

  return (
    <PanelContent className="justify-start">
      {/* Hero Section */}
        <motion.section
          className="relative flex-shrink-0 hero-half"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
        <div className="relative flex flex-col items-center justify-center w-full h-full p-4 text-center">
          <div className="flex flex-col items-center justify-center w-full gap-4 md:gap-8">
            <div className="flex items-center gap-4">
              <BackButton />
              <motion.h1
                layoutId="MEET"
                className="relative z-50 px-6 py-4 font-bold uppercase text-[clamp(3rem,8vw,10rem)]"
              >
                MEET
              </motion.h1>
            </div>
              <motion.p
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="max-w-xl text-lg md:text-2xl"
              >
              {headline}
            </motion.p>
          </div>
        </div>
      </motion.section>

      {/* Carousel + Info Section */}
        <motion.div
          className="flex flex-col items-center justify-center w-full px-4 py-12 space-y-8"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
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
