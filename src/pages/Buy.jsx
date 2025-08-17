import PanelContent from "../components/PanelContent";
import BackButton from "../components/BackButton";
import { motion } from "framer-motion";

export default function Buy() {
  return (
    <PanelContent className="items-start justify-start">
      <motion.section
        className="flex flex-col items-center justify-center p-4 text-center gap-4 hero-full"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <motion.h1
          layoutId="BUY"
          className="relative z-50 px-6 py-4 font-bold uppercase text-[clamp(3rem,8vw,10rem)]"
        >
          BUY
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-lg md:text-2xl max-w-xl"
        >
          Support Renowned Home by backing our upcoming Kickstarter campaign.
        </motion.p>
        <motion.a
          href="#"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-4 px-8 py-3 font-bold uppercase bg-black text-white rounded"
        >
          KICKSTARTER
        </motion.a>
      </motion.section>
    </PanelContent>
  );
}
