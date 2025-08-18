import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PanelContent from "../components/PanelContent";
import IssueCarousel from "../components/IssueCarousel";
import IssueInfoPanel from "../components/IssueInfoPanel";
import BackButton from "../components/BackButton";

export default function Read() {
  const [selectedIssueId, setSelectedIssueId] = useState(null);

  const handleSelect = (id) => {
    setSelectedIssueId((prev) => (prev === id ? null : id));
  };

  return (
    <PanelContent>
      {/* Hero Section */}
      <motion.section
        className="relative flex-shrink-0 hero-half"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="relative flex flex-col items-center justify-center w-full h-full p-4 text-center">
          <div className="flex flex-col items-center justify-center w-full gap-4 md:gap-8">
            <div className="flex items-center gap-4">
              <BackButton />
              <motion.h1
                layoutId="READ"
                className="relative z-50 px-6 py-4 font-bold uppercase text-[clamp(3rem,8vw,10rem)]"
              >
                READ
              </motion.h1>
            </div>
            <motion.p
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="max-w-xl text-lg md:text-2xl"
            >
              Explore the latest issue of Renowned Home.
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
        <IssueCarousel selectedId={selectedIssueId} onSelect={handleSelect} />
        <AnimatePresence mode="wait">
          {selectedIssueId && (
            <IssueInfoPanel issueId={selectedIssueId} key={selectedIssueId} />
          )}
        </AnimatePresence>
      </motion.div>
    </PanelContent>
  );
}
