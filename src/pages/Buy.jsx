import PanelContent from "../components/PanelContent";
import BackButton from "../components/BackButton";
import { motion } from "framer-motion";

export default function Buy() {
  return (
    <PanelContent className="justify-start">
        <motion.section
          className="flex flex-col items-center justify-center gap-4 p-4 text-center hero-full"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
        <div className="flex items-center gap-4">
          <BackButton />
          <motion.h1
            layoutId="BUY"
            className="relative z-50 px-6 py-4 font-bold uppercase text-[clamp(3rem,8vw,10rem)]"
          >
            BUY
          </motion.h1>
        </div>
          <motion.p
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="max-w-xl text-lg md:text-2xl"
          >
          Support Renowned Home by backing our upcoming Kickstarter campaign.
        </motion.p>
          <motion.a
            href="#"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="mt-4 rounded bg-black px-8 py-3 font-bold uppercase text-white"
          >
          KICKSTARTER
        </motion.a>
      </motion.section>
    </PanelContent>
  );
}
