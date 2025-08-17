import PanelContent from "../components/PanelContent";
import BackButton from "../components/BackButton";
import { motion } from "framer-motion";

export default function World() {
  return (
    <PanelContent className="items-start justify-start">
      <BackButton />
      <motion.section
        className="flex items-center justify-center hero-full"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <motion.h1
          layoutId="EXPLORE"
          className="relative z-50 px-6 py-4 font-bold uppercase text-[clamp(3rem,8vw,10rem)]"
        >
          EXPLORE
        </motion.h1>
      </motion.section>
    </PanelContent>
  );
}
