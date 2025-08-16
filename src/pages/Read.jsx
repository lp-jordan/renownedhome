import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PanelContent from "../components/PanelContent";
import IssueCarousel from "../components/IssueCarousel";
import IssueInfoPanel from "../components/IssueInfoPanel";
import ImageWithFallback from "../components/ImageWithFallback";

export default function Read() {
  const [selectedIssueId, setSelectedIssueId] = useState(null);

  const handleSelect = (id) => {
    setSelectedIssueId((prev) => (prev === id ? null : id));
  };

  return (
    <PanelContent>
      {/* Hero Section */}
      <motion.section
        layoutId="READ"
        className="relative w-full h-[75vh] md:h-screen"
      >
        <ImageWithFallback
          src="/read/hero.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
        <div className="relative flex flex-col items-center justify-center w-full h-full p-4 text-center text-white">
          <h1 className="text-4xl md:text-6xl font-bold uppercase">Read</h1>
          <p className="mt-4 text-lg md:text-2xl max-w-xl">
            Explore the latest issue of Renowned Home.
          </p>
          <a
            href="https://flipbook.example.com/full-issue"
            className="mt-8 px-6 py-3 text-base font-semibold bg-blue-600 hover:bg-blue-700 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
            target="_blank"
            rel="noopener noreferrer"
          >
            Read Now
          </a>
        </div>
      </motion.section>

      {/* Carousel + Info Section */}
      <div className="flex flex-col items-center justify-center w-full px-4 py-12 space-y-8">
        <IssueCarousel selectedId={selectedIssueId} onSelect={handleSelect} />
        <AnimatePresence mode="wait">
          {selectedIssueId && (
            <IssueInfoPanel issueId={selectedIssueId} key={selectedIssueId} />
          )}
        </AnimatePresence>
      </div>
    </PanelContent>
  );
}
