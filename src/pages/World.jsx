import PanelContent from "../components/PanelContent";
import BackButton from "../components/BackButton";
import { motion } from "framer-motion";

export default function World() {
  return (
    <motion.div
      layoutId="panel-EXPLORE"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="w-full h-full"
    >
      <PanelContent className="justify-start">
        <motion.section
          className="flex items-center justify-center hero-full"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center gap-4">
            <BackButton />
            <motion.h1
              layoutId="EXPLORE"
              className="relative z-50 px-6 py-4 font-bold uppercase text-[clamp(3rem,8vw,10rem)]"
            >
              EXPLORE
            </motion.h1>
          </div>
        </motion.section>
      </PanelContent>
    </motion.div>
  );
}
