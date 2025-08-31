import PanelContent from "../components/PanelContent";
import BackButton from "../components/BackButton";
import { motion } from "framer-motion";
import usePageSubtitle from "../hooks/usePageSubtitle";

export default function Buy() {
  const { headline } = usePageSubtitle(1);
  return (
    <motion.div
      layoutId="panel-BUY"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="w-full h-full"
    >
      <PanelContent className="justify-start">
        <motion.section
          className="relative flex flex-col items-center justify-center gap-4 p-2 text-center hero-full"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <BackButton />
          <motion.h1
            layoutId="BUY"
            className="relative z-50 px-4 py-2 font-bold uppercase text-[clamp(3rem,8vw,10rem)]"
          >
            BUY
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="max-w-xl text-lg md:text-2xl"
          >
            {headline}
          </motion.p>
          <motion.a
            href="#"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="rounded bg-black px-8 py-3 font-bold uppercase text-white"
          >
            KICKSTARTER
          </motion.a>
        </motion.section>
      </PanelContent>
    </motion.div>
  );
}
