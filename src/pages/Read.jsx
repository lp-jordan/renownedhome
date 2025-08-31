import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PanelContent from "../components/PanelContent";
import IssueCarousel from "../components/IssueCarousel";
import IssueInfoPanel from "../components/IssueInfoPanel";
import BackButton from "../components/BackButton";
import useSupabaseIssues from "../hooks/useSupabaseIssues";
import usePageSubtitle from "../hooks/usePageSubtitle";

export default function Read() {
  const { issues, loading, error } = useSupabaseIssues();
  const [selectedIssue, setSelectedIssue] = useState(null);
  const { headline } = usePageSubtitle(2);

  const handleSelect = (id) => {
    const issue = issues.find((i) => i.id === id);
    setSelectedIssue((prev) => (prev?.id === id ? null : issue));
  };

  if (error) {
    return (
      <PanelContent className="items-center justify-center">
        <div>Error loading issues: {error.message}</div>
      </PanelContent>
    );
  }

  return (
    <motion.div
      layoutId="panel-READ"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="w-full h-full"
    >
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
                  layoutId="READ"
                  className="relative z-50 px-6 py-4 font-bold uppercase text-[clamp(3rem,8vw,10rem)]"
                >
                  READ
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
          <IssueCarousel
            issues={issues}
            loading={loading}
            error={error}
            selectedId={selectedIssue?.id}
            onSelect={handleSelect}
          />
          <AnimatePresence mode="wait">
            {!loading && selectedIssue && (
              <IssueInfoPanel issue={selectedIssue} key={selectedIssue.id} />
            )}
          </AnimatePresence>
        </motion.div>
      </PanelContent>
    </motion.div>
  );
}
