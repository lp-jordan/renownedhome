import PanelContent from "../components/PanelContent";
import { motion } from "framer-motion";

export default function Contact() {
  return (
    <PanelContent className="items-start justify-start">
      <motion.section
        className="flex items-center justify-center hero-half"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <motion.h1
          layoutId="REACH"
          className="px-6 py-4 font-bold uppercase text-[clamp(3rem,8vw,10rem)]"
        >
          REACH
        </motion.h1>
      </motion.section>
    </PanelContent>
  );
}
